import React, { useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FAB from '@/src/components/FAB';
import EmptyState from '@/src/components/EmptyState';
import UploadProgressModal from '@/src/components/UploadProgressModal';
import Snackbar from '@/src/components/Snackbar';
import FileListItem from '@/src/components/FileListItem';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { addFile, updateFile, removeFile } from '@/src/store/filesReducer';
import type { RootStackParamList } from '@/src/navigation/types';
import type { FileItem } from '@/src/types/file';
import {
    pick,
    isErrorWithCode,
    errorCodes,
    type DocumentPickerResponse
} from '@react-native-documents/picker';
import { impactLight, success as hapticSuccess } from '@/src/utils/haptics';
import { setFiles } from '@/src/store/filesReducer';
import { prepareZipFromPickerSelection } from '@/src/utils/zipBundle';
import { safeUnlink, uriToPath } from '@/src/utils/fs';
import ZipProgressModal from '@/src/components/ZipProgressModal';
import { resolveApiConfig, buildApiUrls, buildAuthHeader } from '@/src/utils/api';
import { RealUploadInput, uploadReal } from '@/src/utils/uploadReal';


export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const dispatch = useAppDispatch();
    const files = useAppSelector(state => state.files.items);
    const rootState = useAppSelector(s => s);

    const [isUploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentName, setCurrentName] = useState<string | undefined>(undefined);

    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);
    const [zipCount, setZipCount] = useState<number | undefined>(undefined);

    // Snackbar (generic)
    const [snackVisible, setSnackVisible] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const [snackActionLabel, setSnackActionLabel] = useState<string | undefined>(undefined);
    const snackActionRef = useRef<(() => void) | undefined>(undefined);
    const snackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Upload control
    const cancelUploadRef = useRef<(() => void) | null>(null);
    const currentUploadingIdRef = useRef<string | null>(null);

    // Single source of truth for concurrency
    const hasActiveUpload = () => currentUploadingIdRef.current !== null;

    // THROTTLE refs (single upload only)
    const lastDispatchTsRef = useRef(0);
    const lastPctRef = useRef(0);

    const [refreshing, setRefreshing] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={styles.headerRightRow}>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Info')} disabled={isUploading}>
                        <Text style={[styles.headerBtnText, isUploading && styles.disabled]}>Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings')} disabled={isUploading}>
                        <Text style={[styles.headerBtnText, isUploading && styles.disabled]}>Settings</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, isUploading]);

    // --- Helpers ---------------------------------------------------------------

    // Merge helper: keep unique by id, newest first
    const mergeByIdSorted = (a: FileItem[], b: FileItem[]) => {
        const map = new Map<string, FileItem>();
        // Order matters: later set() wins. We want to prefer local state for the same id (if any).
        [...a, ...b].forEach(f => map.set(f.id, f));
        return Array.from(map.values()).sort((x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0));
    };

    const showSnack = (message: string, actionLabel?: string, onAction?: () => void, timeoutMs = 4000) => {
        if (snackTimerRef.current) clearTimeout(snackTimerRef.current);
        setSnackMsg(message);
        setSnackActionLabel(actionLabel);
        snackActionRef.current = onAction;
        setSnackVisible(true);
        snackTimerRef.current = setTimeout(() => {
            setSnackVisible(false);
            snackTimerRef.current = null;
            snackActionRef.current = undefined;
            setSnackActionLabel(undefined);
        }, timeoutMs);
    };

    const handleSnackAction = () => {
        if (snackTimerRef.current) {
            clearTimeout(snackTimerRef.current);
            snackTimerRef.current = null;
        }
        setSnackVisible(false);
        const fn = snackActionRef.current;
        snackActionRef.current = undefined;
        setSnackActionLabel(undefined);
        if (fn) setTimeout(fn, 0); // lascia completare gli state update prima di eseguire l'azione
    };

    const mapPickerToFileItem = (pf: DocumentPickerResponse): FileItem => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: pf.name ?? 'Unnamed',
        uri: pf.uri,
        type: pf.type ?? 'application/octet-stream',
        size: pf.size ?? 0,
        status: 'uploading',
        progress: 0,
    });

    const mapZipToFileItem = (zip: { zipPath: string; zipName: string; sizeBytes: number; count: number }): FileItem => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: zip.zipName,
        uri: `file://${zip.zipPath}`,
        type: 'application/zip',
        size: zip.sizeBytes,
        status: 'uploading',
        progress: 0,
        createdAt: Date.now(),
        kind: 'zip',
        bundleCount: zip.count,
        localTempPath: zip.zipPath, // path locale SENZA schema per cleanup success/delete
    });

    const beginUpload = async (item: FileItem) => {
        if (hasActiveUpload()) {
            Alert.alert('Upload in progress', 'Please wait until the current upload finishes.');
            return;
        }

        // Reset throttle refs per questo upload
        lastDispatchTsRef.current = 0;
        lastPctRef.current = 0;

        // Blocca UI + setup modale
        setUploading(true);
        setCurrentName(item.name);
        setProgress(0);
        currentUploadingIdRef.current = item.id;

        // Ricava config dal Redux store
        let cfg;
        try {
            cfg = resolveApiConfig(rootState);
        } catch (err: any) {
            setUploading(false);
            currentUploadingIdRef.current = null;
            Alert.alert('Missing settings', String(err?.message ?? err));
            return;
        }

        let input: RealUploadInput;
        if (item.kind === 'zip') {
            if (!item.localTempPath) {
                // caso anomalo: zip senza path locale
                setUploading(false);
                currentUploadingIdRef.current = null;
                Alert.alert('Upload error', 'Missing local ZIP path.');
                return;
            }
            input = { kind: 'zip', path: item.localTempPath, name: item.name };
        } else {
            input = { kind: 'file', uri: item.uri, name: item.name, mime: item.type ?? '' };
        }

        // Avvia upload reale (XMLHttpRequest) con progress e cancel
        try {
            const { result, cancel } = await uploadReal(cfg, input, (pct) => {
                setProgress(pct); // modale: ogni tick

                // Throttle verso Redux
                const now = Date.now();
                const bigEnoughDelta = pct - lastPctRef.current >= 5;
                const spacedEnough = now - lastDispatchTsRef.current >= 150;

                if (bigEnoughDelta || spacedEnough) {
                    lastPctRef.current = pct;
                    lastDispatchTsRef.current = now;
                    dispatch(updateFile(item.id, { progress: pct }));
                }
            });

            cancelUploadRef.current = cancel;

            if (result.ok) {
                // se ZIP locale, rimuovi dal device
                if (item.kind === 'zip' && item.localTempPath) {
                    try { await safeUnlink(item.localTempPath); } catch { }
                    dispatch(updateFile(item.id, { status: 'uploaded', progress: 100, localTempPath: undefined }));
                } else {
                    dispatch(updateFile(item.id, { status: 'uploaded', progress: 100 }));
                }
                setUploading(false);
                setCurrentName(undefined);
                cancelUploadRef.current = null;
                currentUploadingIdRef.current = null;
                hapticSuccess();
            } else {
                // Errori “chiari” dal server (413/415) → mostra dettagli se presenti
                const msg =
                    result.json?.error ||
                    result.json?.message ||
                    result.error ||
                    `Upload failed (HTTP ${result.status})`;
                dispatch(updateFile(item.id, { status: 'failed' }));
                setUploading(false);
                setCurrentName(undefined);
                cancelUploadRef.current = null;
                currentUploadingIdRef.current = null;

                // Messaggi amichevoli per limiti/mime
                if (result.status === 413 && result.json?.limitHuman) {
                    showSnack(`File too large (limit ${result.json.limitHuman})`, 'RETRY', () => retryUpload(item.id));
                } else if (result.status === 415 && Array.isArray(result.json?.allowed)) {
                    showSnack(`Unsupported type. Allowed: ${result.json.allowed.join(', ')}`, 'RETRY', () => retryUpload(item.id));
                } else {
                    showSnack(msg, 'RETRY', () => retryUpload(item.id));
                }
            }
        } catch (err) {
            console.error('Upload error', err);
            dispatch(updateFile(item.id, { status: 'failed' }));
            setUploading(false);
            setCurrentName(undefined);
            cancelUploadRef.current = null;
            currentUploadingIdRef.current = null;
            showSnack('Upload failed', 'RETRY', () => retryUpload(item.id));
        }
    };


    const retryUpload = (id: string) => {
        if (hasActiveUpload()) {
            Alert.alert('Upload in progress', 'Please wait until the current upload finishes.');
            return;
        }
        const existing = files.find(f => f.id === id);
        if (!existing) return;
        dispatch(updateFile(id, { status: 'uploading', progress: 0 }));
        beginUpload({ ...existing, status: 'uploading', progress: 0 });
    };

    // --- Server list helper (real) ---
    const fetchFilesReal = async () => {
        // Leggi config
        const state = useAppSelector(s => s);
        const cfg = resolveApiConfig(state);

        const { primary, fallback } = buildApiUrls(cfg.baseUrl, '/fileuploader/v1/files?page=1&per_page=1000&order=desc');
        const auth = buildAuthHeader(cfg.username, cfg.appPassword);

        // prova primaria
        let res = await fetch(primary, { headers: { Authorization: auth, Accept: 'application/json' } });
        // fallback su 404
        if (res.status === 404) {
            res = await fetch(fallback, { headers: { Authorization: auth, Accept: 'application/json' } });
        }
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Files list failed: HTTP ${res.status} ${text}`);
        }
        const json = await res.json();
        // Adatta il payload del server a FileItem[] (qui presumo il tuo tipo)
        // Server: items: [{ name, url, size, mime, modified }]
        const serverItems: FileItem[] = (json.items ?? []).map((it: any) => ({
            id: `srv_${it.name}`,           // id stabile lato client (puoi migliorarla)
            name: it.name,
            uri: it.url,
            type: it.mime ?? 'application/octet-stream',
            size: Number(it.size ?? 0),
            status: 'uploaded',
            progress: 100,
            createdAt: it.modified ? Date.parse(it.modified) : Date.now(),
            kind: 'server',
        }));
        return serverItems;
    };


    // --- Handlers --------------------------------------------------------------

    const handleAddPress = async () => {
        if (hasActiveUpload()) {
            Alert.alert('Upload in progress', 'Please wait until the current upload finishes.');
            return;
        }
        try {
            const selection = await pick({
                allowMultiSelection: true,
                // opzionale: puoi limitare i tipi; per ora accettiamo tutto
                // type: [types.allFiles],
            });

            if (!selection || selection.length === 0) return;

            if (selection.length === 1) {
                // singolo file → upload "single" come prima (usiamo la copia se presente)
                const pf = selection[0];
                const fileItem: FileItem = {
                    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: pf.name ?? 'Unnamed',
                    uri: pf.uri,
                    type: pf.type ?? 'application/octet-stream',
                    size: pf.size ?? 0,
                    status: 'uploading',
                    progress: 0,
                    createdAt: Date.now(),
                    kind: 'single',
                };
                dispatch(addFile(fileItem));
                beginUpload(fileItem);
                return;
            }

            // multiple: chiedi come procedere (per ora solo ZIP)
            Alert.alert(
                'Multiple files selected',
                'How would you like to upload these files?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Zip all (one upload)',
                        onPress: async () => {
                            try {
                                setIsZipping(true);
                                setZipProgress(0);
                                setZipCount(selection.length);

                                const zipInfo = await prepareZipFromPickerSelection(selection, (pct) => {
                                    setZipProgress(pct);
                                });

                                setIsZipping(false);
                                setZipCount(undefined);
                                setZipProgress(0);

                                const zipItem = mapZipToFileItem(zipInfo);
                                dispatch(addFile(zipItem));
                                beginUpload(zipItem);
                            } catch (err) {
                                setIsZipping(false);
                                setZipCount(undefined);
                                setZipProgress(0);
                                console.error('ZIP preparation failed', err);
                                Alert.alert('ZIP failed', 'Could not create the ZIP archive.');
                            }
                        },
                    },
                    {
                        text: 'Upload separately (soon)',
                        onPress: () => {
                            Alert.alert('Not yet available', 'Uploading files separately will be added soon.');
                        },
                    },
                ],
                { cancelable: true }
            );
        } catch (e: unknown) {
            if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
                return; // user cancelled
            }
            console.error(e);
            Alert.alert('Picker error', String((e as any)?.message ?? e));
        }
    };


    const handleCancelUpload = () => {
        cancelUploadRef.current?.();
        cancelUploadRef.current = null;

        const id = currentUploadingIdRef.current;
        if (id) {
            dispatch(updateFile(id, { status: 'canceled' }));
            showSnack('Upload canceled', 'RETRY', () => retryUpload(id));
        }
        currentUploadingIdRef.current = null;

        setUploading(false);
        setCurrentName(undefined);
        setProgress(0);
    };

    const confirmDelete = (item: FileItem) => {
        impactLight(); // haptic at long-press
        Alert.alert('Delete file', `Delete “${item.name}”?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    // se ZIP locale, cancella anche dal device
                    if (item.kind === 'zip' && item.localTempPath) {
                        await safeUnlink(item.localTempPath);
                    }
                    dispatch(removeFile(item.id));
                    showSnack('File deleted', 'UNDO', () => {
                        // re-add (nota: se era zip con localTempPath, l'UNDO NON ripristina il file fisico sul device)
                        dispatch(addFile(item));
                    });
                },
            },
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const serverItems = await fetchFilesReal();

            // Local items che non sono sul server (uploading/failed/canceled)
            const localPending = files.filter(f =>
                f.status === 'uploading' || f.status === 'failed' || f.status === 'canceled'
            );

            // Merge: server list + local pending (local wins su stesso id)
            const merged = mergeByIdSorted([...serverItems], localPending);
            dispatch(setFiles(merged));
        } catch (e) {
            console.error('Refresh failed', e);
            showSnack('Refresh failed');
        } finally {
            setRefreshing(false);
        }
    };


    // --- Render ----------------------------------------------------------------

    const renderItem = ({ item }: { item: FileItem }) => (
        <FileListItem
            item={item}
            disabled={isUploading}
            onPress={() => navigation.navigate('Details', { id: item.id })}
            onDelete={() => confirmDelete(item)}
            onLongPress={() => confirmDelete(item)}
            onRetry={() => retryUpload(item.id)}
        />
    );

    const keyExtractor = (item: FileItem) => item.id;

    return (
        <View style={styles.container}>
            {files.length === 0 ? (
                <EmptyState onPressPrimary={handleAddPress} />
            ) : (
                <FlatList
                    data={files}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />
            )}

            <FAB onPress={handleAddPress} />

            <UploadProgressModal
                visible={isUploading}
                progress={progress}
                filename={currentName}
                onCancel={handleCancelUpload}
            />

            <ZipProgressModal visible={isZipping} progress={zipProgress} count={zipCount} />

            <Snackbar
                visible={snackVisible}
                message={snackMsg}
                actionLabel={snackActionLabel}
                onAction={handleSnackAction}
                onDismiss={() => setSnackVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    listContent: { padding: 16 },
    headerRightRow: { flexDirection: 'row' },
    headerBtn: { marginLeft: 12, paddingVertical: 6, paddingHorizontal: 8 },
    headerBtnText: { color: '#007aff', fontSize: 15, fontWeight: '500' },
    disabled: { opacity: 0.4 },
});
