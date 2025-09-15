import type {FileItem} from '@/src/types/file';

export type ProgressCallback = (pct: number) => void;
export type CompleteCallback = () => void;
export type ErrorCallback = (err: Error) => void;

export interface MockUploadOptions {
  minMsPerStep?: number; // min delay per tick
  maxMsPerStep?: number; // max delay per tick
  steps?: number;        // number of ticks to reach 100%
}

/**
 * startMockUpload simula un upload lato client.
 * Ritorna una funzione di cancel (che in questa iterazione non esponiamo in UI).
 */
export function startMockUpload(
  _file: FileItem,
  onProgress: ProgressCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback,
  opts: MockUploadOptions = {},
): () => void {
  const {minMsPerStep = 80, maxMsPerStep = 180, steps = 40} = opts;

  let cancelled = false;
  let pct = 0;

  const tick = () => {
    if (cancelled) return;
    pct = Math.min(100, pct + 100 / steps);
    onProgress(pct);
    if (pct >= 100) {
      onComplete();
      return;
    }
    const jitter = Math.floor(Math.random() * (maxMsPerStep - minMsPerStep + 1)) + minMsPerStep;
    setTimeout(tick, jitter);
  };

  setTimeout(tick, minMsPerStep);

  return () => { cancelled = true; };
}
