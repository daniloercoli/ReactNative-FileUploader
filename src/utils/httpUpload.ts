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

function makeFormData(p: UploadParams): FormData {
  const fd = new FormData();
  fd.append('file', {
    uri: p.fileUri.startsWith('file://') ? p.fileUri : `file://${p.fileUri}`,
    name: p.fileName,
    type: p.mimeType,
  } as unknown as Blob);
  return fd;
}

function xhrPost(
  url: string,
  authHeader: string,
  body: FormData,
  onProgress?: UploadProgressCb
): { promise: Promise<UploadResult>; cancel: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<UploadResult>((resolve) => {
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', authHeader);
    xhr.setRequestHeader('Accept', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (!e.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, (e.loaded / e.total) * 100));
        onProgress(pct);
      };
    }

    xhr.onload = () => {
      const status = xhr.status;
      let json: any | undefined;
      try { json = JSON.parse(xhr.responseText); } catch {}
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status, json });
      } else {
        const msg = (json && (json.message || json.error)) || `HTTP ${status}`;
        resolve({ ok: false, status, error: msg, json });
      }
    };
    xhr.onerror = () => resolve({ ok: false, status: xhr.status || 0, error: 'Network error' });
    xhr.ontimeout = () => resolve({ ok: false, status: 0, error: 'Timeout' });

    xhr.send(body);
  });

  return { promise, cancel: () => { try { xhr.abort(); } catch {} } };
}

/**
 * Upload to WP plugin with automatic fallback:
 *  1) try /wp-json/fileuploader/v1/upload
 *  2) on 404 → retry index.php?rest_route=/fileuploader/v1/upload
 */
export async function uploadWithFallback(
  params: UploadParams
): Promise<{ result: UploadResult; handle: UploadCancelHandle }> {
  const { config, onProgress } = params;
  const { primary, fallback } = buildApiUrls(config.baseUrl, '/fileuploader/v1/upload');
  const auth = buildAuthHeader(config.username, config.appPassword);
  const form = makeFormData(params);

  // Try primary
  let { promise, cancel } = xhrPost(primary, auth, form, onProgress);
  let res = await promise;

  // Fallback on 404
  if (!res.ok && res.status === 404) {
    const form2 = makeFormData(params); // must recreate FormData
    const fb = xhrPost(fallback, auth, form2, onProgress);
    cancel = fb.cancel;
    res = await fb.promise;
  }

  if (res.ok && onProgress) { try { onProgress(100); } catch {} }

  return { result: res, handle: { cancel } };
}
