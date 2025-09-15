// Small helper to detect image files by MIME type
export function isImage(mime?: string): boolean {
    return typeof mime === 'string' && mime.startsWith('image/');
}