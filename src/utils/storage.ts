import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FileItem } from '@/src/types/file';

export type Settings = {
    siteUrl: string | null;
    username: string | null;
    password: string | null;
};

const SETTINGS_KEY = 'app.settings.v1';
const FILES_KEY = 'app.files.v1';

export async function loadSettings(): Promise<Settings> {
    try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!raw) return { siteUrl: null, username: null, password: null };
        const parsed = JSON.parse(raw);
        return {
            siteUrl: parsed.siteUrl ?? null,
            username: parsed.username ?? null,
            password: parsed.password ?? null,
        };
    } catch {
        return { siteUrl: null, username: null, password: null };
    }
}

export async function saveSettings(s: Settings): Promise<void> {
    const safe: Settings = {
        siteUrl: s.siteUrl ?? null,
        username: s.username ?? null,
        password: s.password ?? null,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
}

export async function loadFiles(): Promise<FileItem[]> {
    try {
        const raw = await AsyncStorage.getItem(FILES_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
        return [];
    } catch {
        return [];
    }
}

export async function saveFiles(items: FileItem[]): Promise<void> {
    await AsyncStorage.setItem(FILES_KEY, JSON.stringify(items));
}

export async function clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([SETTINGS_KEY, FILES_KEY]);
}
