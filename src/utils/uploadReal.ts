// Small adapter to upload either a ZIP (device path) or a single file (uri).
import { uploadWithFallback } from './httpUpload';
import type { ApiConfig } from './api';

export type RealUploadInput =
  | { kind: 'zip'; path: string; name: string }                   // application/zip
  | { kind: 'file'; uri: string; name: string; mime: string };    // generic file

function hasScheme(u: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u);
}

export async function uploadReal(
  cfg: ApiConfig,
  input: RealUploadInput,
  onProgress?: (pct: number) => void
) {
  const mime = input.kind === 'zip' ? 'application/zip' : input.mime;

  const uri =
    input.kind === 'zip'
      ? (hasScheme(input.path) ? input.path : `file://${input.path}`) // zip: path locale -> file://
      : (hasScheme(input.uri) ? input.uri : `file://${input.uri}`);   // singolo: rispetta content://

  const { result, handle } = await uploadWithFallback({
    config: cfg,
    fileUri: uri,
    fileName: input.name,
    mimeType: mime,
    onProgress,
  });

  return { result, cancel: handle.cancel };
}
