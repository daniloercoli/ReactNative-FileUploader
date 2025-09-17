// src/utils/zipBundle.ts
import RNFS from 'react-native-fs';
import { zip, subscribe } from 'react-native-zip-archive';
import {
    BATCH_DIR,
    ZIPS_DIR,
    ensureDir,
    uriToPath,
    join,
    sanitizeFilename,
    dirname,
    basename,
} from './fs';
import type {
    DocumentPickerResponse,
    FileToCopy,
    LocalCopyResponse,
} from '@react-native-documents/picker';
import { keepLocalCopy } from '@react-native-documents/picker';

/**
 * Prepara uno ZIP a partire dalla selezione del picker:
 * 1) keepLocalCopy(..., destination:'cachesDirectory') → ottieni localUri per ogni file
 * 2) sposta SOLO le copie locali in una cartella di staging (progress 0..30)
 * 3) crea lo ZIP della cartella (progress 30..100 via subscribe)
 *
 * Ritorna:
 *  - zipPath: path locale SENZA schema file://
 *  - zipName: nome zip (es. upload-YYYYMMDDHHmmss.zip)
 *  - sizeBytes: dimensione dello zip
 *  - count: numero di file inclusi
 */
export async function prepareZipFromPickerSelection(
    selection: DocumentPickerResponse[],
    onProgress?: (pct: number) => void,
): Promise<{ zipPath: string; zipName: string; sizeBytes: number; count: number }> {
    if (!selection || selection.length === 0) {
        throw new Error('Empty selection');
    }

    // ---------- 1) Copie locali nella cache dell’app ----------
    // Costruisci NonEmptyArray<FileToCopy> richiesto dall’API
    const toFileToCopy = (f: DocumentPickerResponse, idx: number): FileToCopy => ({
        uri: f.uri,
        fileName: sanitizeFilename(f.name ?? `file-${idx + 1}`),
        ...(f.isVirtual &&
            Array.isArray(f.convertibleToMimeTypes) &&
            f.convertibleToMimeTypes.length > 0
            ? { convertVirtualFileToType: f.convertibleToMimeTypes[0]!.mimeType }
            : {}),
    });

    const mapped: FileToCopy[] = selection.map(toFileToCopy);
    const copyInputs: [FileToCopy, ...FileToCopy[]] = [mapped[0], ...mapped.slice(1)];

    const copyResults = await keepLocalCopy({
        files: copyInputs,
        destination: 'cachesDirectory',
    });

    // Type guard per restringere LocalCopyResponse alla variante di successo
    function isLocalCopySuccess(
        r: LocalCopyResponse,
    ): r is Extract<LocalCopyResponse, { status: 'success'; localUri: string; sourceUri: string }> {
        return r.status === 'success' && typeof (r as any).localUri === 'string';
    }

    const successes = copyResults.filter(isLocalCopySuccess);
    if (successes.length === 0) {
        throw new Error('keepLocalCopy failed for all files');
    }

    // Prepara entries tipate (localUri + nome file coerente)
    type StagedEntry = { localUri: string; fileName: string };
    const successEntries: StagedEntry[] = successes.map((r, idx) => {
        // Prova a riprendere il nome originale dal selection, fallback su basename del localUri
        const orig = selection.find(f => f.uri === r.sourceUri);
        const fileName = sanitizeFilename(orig?.name ?? basename(uriToPath(r.localUri)));
        return { localUri: r.localUri, fileName };
    });

    // Directory “sorgente” creata da keepLocalCopy (parent del primo file)
    const firstLocalPath = uriToPath(successEntries[0].localUri);
    const keepDir = dirname(firstLocalPath);
    if (!keepDir) {
        throw new Error('Unexpected keepLocalCopy localUri format');
    }

    // ---------- 2) Staging: sposta le COPIE in una tua cartella batch ----------
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); // YYYYMMDDHHmmss
    const batchDir = join(BATCH_DIR, `batch-${stamp}`);
    const zipsDir = ZIPS_DIR;

    await ensureDir(BATCH_DIR);
    await ensureDir(zipsDir);
    await ensureDir(batchDir);

    const usedNames = new Set<string>();
    let idx = 0;
    for (const { localUri, fileName } of successEntries) {
        const srcPath = uriToPath(localUri);

        // Evita collisioni di nome dentro lo stesso batch
        let finalName = fileName;
        let counter = 1;
        while (usedNames.has(finalName)) {
            const dot = fileName.lastIndexOf('.');
            finalName =
                dot > 0
                    ? `${fileName.slice(0, dot)} (${counter})${fileName.slice(dot)}`
                    : `${fileName} (${counter})`;
            counter++;
        }
        usedNames.add(finalName);

        const dst = join(batchDir, finalName);
        await RNFS.moveFile(srcPath, dst);

        idx++;
        if (onProgress) onProgress((idx / successEntries.length) * 30); // 0..30
    }

    // Pulisci la dir creata da keepLocalCopy (ormai vuota)
    try {
        await RNFS.unlink(keepDir);
    } catch {
        // non bloccare in caso di fallimento della pulizia
    }

    // ---------- 3) ZIP con progress 30..100 ----------
    const zipName = `upload-${stamp}.zip`;
    const zipTarget = join(zipsDir, zipName);

    let sub: { remove: () => void } | null = null;
    if (onProgress) {
        sub = subscribe(({ progress, filePath }) => {
            // subscribe è globale: filtra per il nostro zipName
            if (filePath && filePath.endsWith(zipName)) {
                const pct = 30 + Math.max(0, Math.min(1, progress)) * 70; // 30..100
                onProgress(pct);
            }
        });
    }

    try {
        const zipTargetUri = await zip(batchDir, zipTarget);
        const stat = await RNFS.stat(zipTargetUri);
        if (onProgress) onProgress(100); // forza 100% al completamento zip
        return {
            zipPath: zipTarget,                // path senza "file://"
            zipName,
            sizeBytes: Number(stat.size ?? 0),
            count: successEntries.length,
        };
    } finally {
        // cleanup staging + unsubscribe
        try {
            await RNFS.unlink(batchDir);
        } catch { }
        if (sub) {
            try {
                sub.remove();
            } catch { }
        }
    }
}
