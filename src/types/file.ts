// Shared type for file items stored in Redux
export type UploadStatus = 'uploaded' | 'uploading' | 'failed' | 'canceled';

export interface FileItem {
  id: string;
  name: string;
  uri: string;           // device URI
  type?: string;         // MIME type
  size?: number;         // bytes
  status?: UploadStatus; // defaults to 'uploaded'
  progress?: number;     // 0..100
}
