// Creates the Redux store using vanilla Redux combineReducers
import { createStore, combineReducers } from 'redux';
import auth from './authReducer';
import files from './filesReducer';


const rootReducer = combineReducers({ auth, files });


export const store = createStore(rootReducer);


// Inferred types for typed hooks/selectors
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;