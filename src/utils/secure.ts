import * as Keychain from 'react-native-keychain';

const GENERIC_SERVICE = 'fileuploader.credentials';

/**
 * Save (or remove) the password securely.
 * - If `password` is falsy ⇒ remove credentials (both internet + generic).
 * - If `siteUrl` is present ⇒ use InternetCredentials(server).
 * - Else ⇒ use GenericPassword(service).
 */
export async function saveSecurePassword(
    siteUrl: string | null,
    username: string | null,
    password: string | null
) {
    const server = siteUrl?.toLowerCase() ?? null;

    try {
        if (!password) {
            // Remove credentials
            if (server) {
                try {
                    await Keychain.resetInternetCredentials({ server }); // BaseOptions-safe
                } catch (e) {
                    console.warn('resetInternetCredentials error', e);
                }
            }
            try {
                await Keychain.resetGenericPassword({ service: GENERIC_SERVICE });
            } catch (e) {
                console.warn('resetGenericPassword error', e);
            }
            return;
        }

        const account = username ?? 'user';

        if (server) {
            await Keychain.setInternetCredentials(server, account, password);
        } else {
            await Keychain.setGenericPassword(account, password, { service: GENERIC_SERVICE });
        }
    } catch (e) {
        console.warn('saveSecurePassword failed', e);
    }
}

/**
 * Load the secure password, preferring InternetCredentials for the given siteUrl.
 */
export async function loadSecurePassword(siteUrl: string | null): Promise<string | null> {
    const server = siteUrl?.toLowerCase() ?? null;

    try {
        if (server) {
            const creds = await Keychain.getInternetCredentials(server);
            if (creds) return creds.password;
        } else {
            const gp = await Keychain.getGenericPassword({ service: GENERIC_SERVICE });
            if (gp) return gp.password;
        }
    } catch (e) {
        console.warn('loadSecurePassword failed', e);
    }

    return null;
}

/**
 * Explicit clear helper (optional): wipes both slots.
 */
export async function clearSecurePassword(siteUrl: string | null) {
    const server = siteUrl?.toLowerCase() ?? null;

    try {
        if (server) {
            try {
                await Keychain.resetInternetCredentials({ server });
            } catch (e) {
                console.warn('resetInternetCredentials error', e);
            }
        }
        try {
            await Keychain.resetGenericPassword({ service: GENERIC_SERVICE });
        } catch (e) {
            console.warn('resetGenericPassword error', e);
        }
    } catch (e) {
        console.warn('clearSecurePassword failed', e);
    }
}
