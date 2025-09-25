// src/utils/api.ts
// Minimal API helpers wired to your Redux store shape (auth slice).

import type { RootState } from '@/src/store';

// ---- Types ----
export type ApiConfig = {
  baseUrl: string;     // e.g. "https://example.com/wp1"
  username: string;    // WP username
  appPassword: string; // WP Application Password (from Redux auth.password in your case)
};

export type AuthShape = {
  siteUrl: string | null;
  username: string | null;
  password: string | null;
};

// ---- Selectors ----
export function selectAuth(state: RootState): AuthShape {
  return state.auth;
}

// ---- URL helpers ----
/** Ensure scheme, strip trailing slashes (http/https not enforced) */
export function normalizeBaseUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

/** Build primary (/wp-json/...) and fallback (index.php?rest_route=/...) endpoints */
export function buildApiUrls(baseUrl: string, route: string) {
  const base = (baseUrl || '').replace(/\/+$/, '');
  const cleanRoute = route.replace(/^\/+/, '');
  return {
    primary: `${base}/wp-json/${cleanRoute}`,
    fallback: `${base}/index.php?rest_route=/${cleanRoute}`,
  };
}

/** Basic Auth header "Basic base64(username:appPassword)" */
export function buildAuthHeader(username: string, appPassword: string) {
  const token = base64Encode(`${username}:${appPassword}`);
  return `Basic ${token}`;
}

// ---- Config from Redux ----
/**
 * Resolve API config from Redux state (auth slice).
 * Throws if any required field is missing.
 */
export function resolveApiConfig(state: RootState): ApiConfig {
  const { siteUrl, username, password } = selectAuth(state);

  if (!siteUrl) throw new Error('Missing Site URL in settings');
  if (!username) throw new Error('Missing username in settings');
  if (!password) throw new Error('Missing application password in settings');

  const baseUrl = normalizeBaseUrl(siteUrl);
  return {
    baseUrl,
    username: username.trim(),
    appPassword: password,
  };
}

// ---- Base64 (RN-safe) ----
function base64Encode(input: string): string {
  // Prefer global.btoa if available in your RN runtime
  // @ts-ignore
  if (typeof global !== 'undefined' && typeof (global as any).btoa === 'function') {
    // @ts-ignore
    return (global as any).btoa(input);
  }
  // Fallback to Buffer if available
  // @ts-ignore
  if (typeof Buffer !== 'undefined') {
    // @ts-ignore
    return Buffer.from(input, 'utf8').toString('base64');
  }
  // Minimal ASCII-only fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input, output = '';
  for (let block = 0, charCode: number, i = 0, map = chars;
       str.charAt(i | 0) || ((map = '='), i % 1);
       output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) throw new Error('base64Encode: non-ASCII input');
    block = (block << 8) | charCode;
  }
  return output;
}
