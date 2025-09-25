// src/utils/uploadReal.ts
// Small adapter to upload either a ZIP (device path) or a single file (uri).

import { uploadWithFallback } from './httpUpload';
import type { ApiConfig } from './api';

export type RealUploadInput =
  | { kind: 'zip'; path: string; name: string }                   // application/zip
  | { kind: 'file'; uri: string; name: string; mime: string };    // generic file

export async function uploadReal(
  cfg: ApiConfig,
  input: RealUploadInput,
  onProgress?: (pct: number) => void
) {
  const mime = input.kind === 'zip' ? 'application/zip' : input.mime;
  const uri  = input.kind === 'zip'
    ? (input.path.startsWith('file://') ? input.path : `file://${input.path}`)
    : (input.uri.startsWith('file://') ? input.uri : `file://${input.uri}`);

  const { result, handle } = await uploadWithFallback({
    config: cfg,
    fileUri: uri,
    fileName: input.name,
    mimeType: mime,
    onProgress,
  });

  return { result, cancel: handle.cancel };
}
