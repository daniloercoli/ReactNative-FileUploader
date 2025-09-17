// Shared type for file items stored in Redux
export type UploadStatus = 'uploaded' | 'uploading' | 'failed' | 'canceled';

export interface FileItem {
    id: string;
    name: string;
    uri: string;           // device URI (file://) o remoto
    type?: string;         // MIME
    size?: number;         // bytes
    status?: UploadStatus; // default 'uploaded'
    progress?: number;     // 0..100
    createdAt?: number;
    kind?: 'single' | 'zip'; // info bundle for ZIP
    bundleCount?: number;
    /** path locale al file ZIP (senza schema) da cancellare al successo o al delete */
    localTempPath?: string;
}
