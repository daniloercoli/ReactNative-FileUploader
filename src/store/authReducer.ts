// Simple reducer to store the Application Password in plain Redux state.
// In production, prefer secure storage (Keychain/Keystore) and avoid keeping secrets in memory.

type SetPasswordAction = { type: 'auth/SET_PASSWORD'; payload: string | null };

type AuthActions = SetPasswordAction;

export const setPassword = (password: string | null): SetPasswordAction => ({
    type: 'auth/SET_PASSWORD',
    payload: password,
});

export interface AuthState {
    password: string | null;
}

const initialState: AuthState = {
    password: null,
};

export default function authReducer(
    state: AuthState = initialState,
    action: AuthActions,
): AuthState {
    switch (action.type) {
        case 'auth/SET_PASSWORD':
            return { ...state, password: action.payload };
        default:
            return state;
    }
}