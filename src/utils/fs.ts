// src/utils/fs.ts
import RNFS from 'react-native-fs';

export const CACHE_BASE = `${RNFS.CachesDirectoryPath}/upload-batches`;
export const BATCH_DIR = `${CACHE_BASE}/batches`;
export const ZIPS_DIR = `${CACHE_BASE}/zips`;

export const uriToPath = (uri: string) => uri.replace(/^file:\/\//, '');
export const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() || '';
export const dirname = (p: string) => {               // <-- NEW
    const noTrail = p.replace(/\/+$/, '');
    const m = noTrail.match(/^(.*)\/[^/]+$/);
    return m ? m[1] : '';
};
export const join = (...parts: string[]) =>
    parts
        .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
        .filter(Boolean)
        .join('/');

export async function ensureDir(path: string) {
    const exists = await RNFS.exists(path);
    if (!exists) await RNFS.mkdir(path);
}

export async function safeUnlink(path: string) {
    try {
        if (await RNFS.exists(path)) await RNFS.unlink(path);
    } catch (e) {
        console.warn('safeUnlink error', e);
    }
}

export function sanitizeFilename(name: string): string {
    const safe = name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim();
    return safe.length ? safe : 'file';
}