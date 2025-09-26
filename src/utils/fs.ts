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

export function formatBytes(n?: number): string {
  if (!n || n <= 0) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return i === 0 ? `${v} ${units[i]}` : `${v.toFixed(2)} ${units[i]}`;
}