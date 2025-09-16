// Creates the Redux store using vanilla Redux combineReducers
import { createStore, combineReducers } from 'redux';
import auth from './authReducer';
import files from './filesReducer';

const appReducer = combineReducers({ auth, files });

// Global reset (es. da Settings → Reset App)
const RESET = 'app/RESET';
export const resetApp = () => ({ type: RESET } as const);
type ResetAction = ReturnType<typeof resetApp>;

function rootReducer(state: ReturnType<typeof appReducer> | undefined, action: any) {
    if (action?.type === RESET) {
        // azzera lo state, i reducer ripartono da initialState
        state = undefined;
    }
    return appReducer(state, action);
}

export const store = createStore(rootReducer);

// Inferred types for typed hooks/selectors
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;