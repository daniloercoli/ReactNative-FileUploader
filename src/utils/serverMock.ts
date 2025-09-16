// src/utils/serverMock.ts
import type { FileItem } from '@/src/types/file';

/**
 * Mock server list: returns a list of uploaded files as if fetched from your server.
 * In a real integration, replace this with a fetch(...) call to your WP REST endpoint.
 */
export async function fetchFilesMock(): Promise<FileItem[]> {
    // Simulate network latency
    await new Promise<void>(res => setTimeout(res, 600));

    // Create deterministic-ish sample files (server-owned ids prefixed with srv_)
    const now = Date.now();
    const samples: FileItem[] = [
        {
            id: 'srv_1001',
            name: 'invoice-august.pdf',
            uri: 'https://example.com/files/invoice-august.pdf',
            type: 'application/pdf',
            size: 248_900,
            status: 'uploaded',
            progress: 100,
            createdAt: now - 1000 * 60 * 60 * 24 * 2, // 2 days ago
        },
        {
            id: 'srv_1002',
            name: 'photo-trip.jpg',
            uri: 'https://example.com/files/photo-trip.jpg',
            type: 'image/jpeg',
            size: 1_024_000,
            status: 'uploaded',
            progress: 100,
            createdAt: now - 1000 * 60 * 60 * 6, // 6 hours ago
        },
        {
            id: 'srv_1003',
            name: 'diagram.png',
            uri: 'https://example.com/files/diagram.png',
            type: 'image/png',
            size: 512_500,
            status: 'uploaded',
            progress: 100,
            createdAt: now - 1000 * 60 * 30, // 30 minutes ago
        },
    ];

    // Sort newest first (server responsibility in real impl.)
    samples.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return samples;
}
