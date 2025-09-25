// src/utils/httpUpload.ts
// Real HTTP upload with progress + cancel (XMLHttpRequest), with wp-json → index.php fallback.

import { buildApiUrls, buildAuthHeader, type ApiConfig } from './api';

export type UploadProgressCb = (pct: number) => void;

export type UploadResult =
    | { ok: true; status: number; json: any }
    | { ok: false; status: number; error: string; json?: any };

export type UploadCancelHandle = { cancel: () => void };

export type UploadParams = {
    config: ApiConfig;
    fileUri: string;   // "file:///..." (ensure prefix)
    fileName: string;  // e.g. "upload-20250924.zip"
    mimeType: string;  // e.g. "application/zip"
    onProgress?: UploadProgressCb;
};
// Small helpers for safe logging
const now = () => Date.now();
const dur = (t0: number) => `${Date.now() - t0}ms`;
const maskAuth = (authHeader: string) => {
    // e.g. "Basic dXNlcjphcHBfcGFzc..." → keep scheme + first 6 chars
    const [scheme, token] = authHeader.split(' ');
    if (!token) return authHeader;
    return `${scheme} ${token.slice(0, 6)}…(${token.length})`;
};

function makeFormData(p: UploadParams): FormData {
    const fd = new FormData();
    try {
        const uri = p.fileUri.startsWith('file://') ? p.fileUri : `file://${p.fileUri}`;
        fd.append('file', { uri, name: p.fileName, type: p.mimeType } as unknown as Blob);
        console.debug('[upload] FormData prepared', {
            name: p.fileName,
            type: p.mimeType,
            hasFile: true,
        });
    } catch (err) {
        console.error('[upload] FormData error', err);
        throw err; // bubble up, nothing we can do without a body
    }
    return fd;
}

function xhrPost(
    url: string,
    authHeader: string,
    body: FormData,
    onProgress?: UploadProgressCb
): { promise: Promise<UploadResult>; cancel: () => void } {
    const xhr = new XMLHttpRequest();
    const t0 = now();

    const promise = new Promise<UploadResult>((resolve) => {
        try {
            console.info('[upload] POST start', { url, auth: maskAuth(authHeader) });
            xhr.open('POST', url);
            xhr.setRequestHeader('Authorization', authHeader);
            xhr.setRequestHeader('Accept', 'application/json');

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (e: ProgressEvent) => {
                    if (!e.lengthComputable) return;
                    const pct = Math.max(0, Math.min(100, (e.loaded / e.total) * 100));
                    try {
                        onProgress(pct);
                    } catch (cbErr) {
                        // Non-fatal: log but continue
                        console.warn('[upload] onProgress callback threw', cbErr);
                    }
                };
            }

            xhr.onload = () => {
                const status = xhr.status;
                let json: any | undefined;
                try {
                    json = JSON.parse(xhr.responseText);
                } catch (parseErr) {
                    // Non-fatal: backend might not return JSON on error
                    console.warn('[upload] JSON parse failed', { url, status, parseErr });
                }

                if (status >= 200 && status < 300) {
                    console.info('[upload] POST success', { url, status, elapsed: dur(t0), json });
                    resolve({ ok: true, status, json });
                } else {
                    const msg = (json && (json.message || json.error)) || `HTTP ${status}`;
                    console.warn('[upload] POST failed', { url, status, elapsed: dur(t0), error: msg, json });
                    resolve({ ok: false, status, error: msg, json });
                }
            };

            xhr.onerror = (ev) => {
                const extra = {
                    readyState: xhr.readyState,   // es. 4 = DONE
                    status: xhr.status,           // quasi sempre 0
                    responseURL: xhr.responseURL, // vuoto se non ha raggiunto il server
                    responseText: xhr.responseText?.slice(0, 200), // primi 200 char
                    eventType: ev?.type,
                };
                console.error('[upload] Network error', { url, elapsed: dur(t0), ...extra });
                resolve({ ok: false, status: xhr.status || 0, error: 'Network error' });
            };

            xhr.ontimeout = () => {
                console.error('[upload] Timeout', { url, elapsed: dur(t0) });
                resolve({ ok: false, status: 0, error: 'Timeout' });
            };

            xhr.onabort = () => {
                console.warn('[upload] Aborted by caller', { url, elapsed: dur(t0) });
                resolve({ ok: false, status: 0, error: 'Aborted' });
            };

            xhr.send(body);
            console.debug('[upload] POST sent', { url });
        } catch (err) {
            console.error('[upload] Unexpected error before send', { url, elapsed: dur(t0), err });
            resolve({ ok: false, status: 0, error: 'Client error (before send)' });
        }
    });

    const cancel = () => {
        try {
            xhr.abort();
        } catch (abortErr) {
            console.warn('[upload] abort() threw', abortErr);
        }
    };

    return { promise, cancel };
}

/**
 * Upload to WP plugin with automatic fallback:
 *  1) try /wp-json/fileuploader/v1/upload
 *  2) on 404 → retry index.php?rest_route=/fileuploader/v1/upload
 */
export async function uploadWithFallback(
    params: UploadParams
): Promise<{ result: UploadResult; handle: UploadCancelHandle }> {
    const t0 = now();
    console.debug('[uploadWithFallback] begin', {
        baseUrl: params.config.baseUrl,
        fileName: params.fileName,
        mimeType: params.mimeType,
    });

    let cancel: () => void = () => { };
    try {
        const { config, onProgress } = params;

        let primary: string, fallback: string, auth: string, form: FormData;
        try {
            ({ primary, fallback } = buildApiUrls(config.baseUrl, '/fileuploader/v1/upload'));
            auth = buildAuthHeader(config.username, config.appPassword);
            form = makeFormData(params);
            console.debug('[uploadWithFallback] prepared', {
                primary,
                fallback,
                auth: maskAuth(auth),
            });
        } catch (prepErr) {
            console.error('[uploadWithFallback] preparation failed', prepErr);
            return { result: { ok: false, status: 0, error: 'Preparation error' }, handle: { cancel } };
        }

        // Try primary
        let post1: ReturnType<typeof xhrPost>;
        try {
            post1 = xhrPost(primary, auth, form, onProgress);
            cancel = post1.cancel;
        } catch (postInitErr) {
            console.error('[uploadWithFallback] xhrPost init failed (primary)', postInitErr);
            return { result: { ok: false, status: 0, error: 'Init error' }, handle: { cancel } };
        }

        let res = await post1.promise;

        // Fallback on 404
        if (!res.ok && res.status === 404) {
            console.warn('[uploadWithFallback] primary returned 404, trying fallback', { primary, fallback });
            let form2: FormData;
            try {
                form2 = makeFormData(params); // must recreate FormData
            } catch (fdErr) {
                console.error('[uploadWithFallback] FormData re-create failed for fallback', fdErr);
                return { result: res, handle: { cancel } }; // keep primary result
            }

            try {
                const fb = xhrPost(fallback, auth, form2, onProgress);
                cancel = fb.cancel; // override cancel handle to newest request
                res = await fb.promise;
            } catch (fbInitErr) {
                console.error('[uploadWithFallback] xhrPost init failed (fallback)', fbInitErr);
                // keep last res (404) to give the caller context
            }
        }

        if (res.ok && params.onProgress) {
            try {
                params.onProgress(100);
            } catch (cbErr) {
                console.warn('[uploadWithFallback] onProgress(100) threw', cbErr);
            }
        }

        console.info('[uploadWithFallback] end', { elapsed: dur(t0), ok: res.ok, status: res.status });
        return { result: res, handle: { cancel } };
    } catch (err) {
        console.error('[uploadWithFallback] unexpected top-level error', { err, elapsed: dur(t0) });
        return { result: { ok: false, status: 0, error: 'Unexpected error' }, handle: { cancel } };
    }
}
