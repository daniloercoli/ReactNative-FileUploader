// src/utils/filesApi.ts
import { buildApiUrls, buildAuthHeader, type ApiConfig } from './api';
import type { FileItem } from '@/src/types/file';

export async function fetchFilesList(cfg: ApiConfig, page = 1, perPage = 1000, order: 'asc' | 'desc' = 'desc'): Promise<FileItem[]> {
    const route = `/fileuploader/v1/files?page=${page}&per_page=${perPage}&order=${order}`;
    const { primary, fallback } = buildApiUrls(cfg.baseUrl, route);
    const auth = buildAuthHeader(cfg.username, cfg.appPassword);

    let res: Response;
    try {
        res = await fetch(primary, { headers: { Authorization: auth, Accept: 'application/json' } });
    } catch (err) {
        console.error('[files] primary fetch error', err);
        // tenta direttamente fallback se la primary non è raggiungibile
        res = await fetch(fallback, { headers: { Authorization: auth, Accept: 'application/json' } });
    }

    if (res.status === 404) {
        console.warn('[files] primary 404, trying fallback');
        res = await fetch(fallback, { headers: { Authorization: auth, Accept: 'application/json' } });
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[files] fetch failed', res.status, text);
        throw new Error(`Files list failed: HTTP ${res.status}`);
    }

    const json = await res.json().catch(() => ({}));
    const items = Array.isArray(json.items) ? json.items : [];
    const mapped: FileItem[] = items.map((it: any) => ({
        id: `srv_${String(it.name)}`,
        name: String(it.name ?? 'Unnamed'),
        uri: String(it.url ?? ''),
        type: String(it.mime ?? 'application/octet-stream'),
        size: Number(it.size ?? 0),
        status: 'uploaded',
        progress: 100,
        createdAt: it.modified ? Date.parse(String(it.modified)) : Date.now(),
        kind: 'server',
    }));
    return mapped;
}
