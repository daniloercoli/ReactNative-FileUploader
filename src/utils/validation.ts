/**
 * Restituisce una URL normalizzata (senza trailing slash), oppure null se non valida.
 * - accetta SOLO http/https
 * - se manca lo schema, prova con https://
 */
export function normalizeUrl(input: string): string | null {
    const raw = (input || '').trim();
    if (!raw) return null;

    // se l'utente non inserisce lo schema, proviamo ad aggiungere https://
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;

    try {
        const u = new URL(withScheme);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        // rimuovi eventuale trailing slash (puramente estetico)
        if (u.pathname === '/' && !u.search && !u.hash) {
            return `${u.protocol}//${u.host}`;
        }
        return u.toString().replace(/\/+$/, '');
    } catch {
        return null;
    }
}
