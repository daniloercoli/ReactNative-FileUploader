// Simple reducer to store the Application Password in plain Redux state.
// In production, prefer secure storage (Keychain/Keystore) and avoid keeping secrets in memory.
import type { Settings } from '@/src/utils/storage';

type SetPasswordAction = { type: 'auth/SET_PASSWORD'; payload: string | null };
type SetUsernameAction = { type: 'auth/SET_USERNAME'; payload: string | null };
type SetSiteUrlAction = { type: 'auth/SET_SITEURL'; payload: string | null };
type HydrateAuthAction = { type: 'auth/HYDRATE'; payload: Settings };

type AuthActions = SetPasswordAction | SetUsernameAction | SetSiteUrlAction | HydrateAuthAction;

export const setPassword = (password: string | null): SetPasswordAction => ({
    type: 'auth/SET_PASSWORD',
    payload: password,
});
export const setUsername = (username: string | null): SetUsernameAction => ({
    type: 'auth/SET_USERNAME',
    payload: username,
});
export const setSiteUrl = (siteUrl: string | null): SetSiteUrlAction => ({
    type: 'auth/SET_SITEURL',
    payload: siteUrl,
});
export const hydrateAuth = (settings: Settings): HydrateAuthAction => ({
    type: 'auth/HYDRATE',
    payload: settings,
});

export interface AuthState {
    siteUrl: string | null;
    username: string | null;
    password: string | null;
}

const initialState: AuthState = {
    siteUrl: null,
    username: null,
    password: null,
};

export default function authReducer(
    state: AuthState = initialState,
    action: AuthActions,
): AuthState {
    switch (action.type) {
        case 'auth/SET_PASSWORD':
            return { ...state, password: action.payload };
        case 'auth/SET_USERNAME':
            return { ...state, username: action.payload };
        case 'auth/SET_SITEURL':
            return { ...state, siteUrl: action.payload };
        case 'auth/HYDRATE':
            return { ...state, ...action.payload };
        default:
            return state;
    }
}
