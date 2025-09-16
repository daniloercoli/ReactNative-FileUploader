// src/store/filesReducer.ts
import type { FileItem } from '@/src/types/file';

// Action types
export type AddFileAction = { type: 'files/ADD_FILE'; payload: FileItem };
export type RemoveFileAction = { type: 'files/REMOVE_FILE'; payload: string };
export type UpdateFileAction = {
    type: 'files/UPDATE_FILE';
    payload: { id: string; patch: Partial<FileItem> };
};
export type SetFilesAction = { type: 'files/SET_FILES'; payload: FileItem[] };

export type FilesActions = AddFileAction | RemoveFileAction | UpdateFileAction | SetFilesAction;

// Action creators
export const addFile = (file: FileItem): AddFileAction => ({ type: 'files/ADD_FILE', payload: file });
export const removeFile = (id: string): RemoveFileAction => ({ type: 'files/REMOVE_FILE', payload: id });
export const updateFile = (id: string, patch: Partial<FileItem>): UpdateFileAction => ({
    type: 'files/UPDATE_FILE',
    payload: { id, patch },
});
export const setFiles = (items: FileItem[]): SetFilesAction => ({ type: 'files/SET_FILES', payload: items });

export interface FilesState {
    items: FileItem[];
}

const initialState: FilesState = {
    items: [], // { id, name, uri, type, size, status, progress, createdAt }
};

export default function filesReducer(
    state: FilesState = initialState,
    action: FilesActions,
): FilesState {
    switch (action.type) {
        case 'files/ADD_FILE':
            return { ...state, items: [action.payload, ...state.items] };
        case 'files/REMOVE_FILE':
            return { ...state, items: state.items.filter(f => f.id !== action.payload) };
        case 'files/UPDATE_FILE':
            return {
                ...state,
                items: state.items.map(f => (f.id === action.payload.id ? { ...f, ...action.payload.patch } : f)),
            };
        case 'files/SET_FILES':
            return { ...state, items: action.payload };
        default:
            return state;
    }
}
