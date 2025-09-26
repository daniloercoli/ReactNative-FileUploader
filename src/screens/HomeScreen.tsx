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
import { resolveApiConfigFromAuth, buildApiUrls, buildAuthHeader } from '@/src/utils/api';
import { RealUploadInput, uploadReal } from '@/src/utils/uploadReal';
import BlockingLoaderModal from '@/src/components/BlockingLoaderModal';
import { fetchFilesList } from '@/src/utils/filesApi';
import Clipboard from '@react-native-clipboard/clipboard';
import { Platform, ToastAndroid } from 'react-native';

export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const dispatch = useAppDispatch();
    const files = useAppSelector(state => state.files.items);
    const auth = useAppSelector(state => state.auth);
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

    // Stato locale per il primo sync
    const [initialSyncVisible, setInitialSyncVisible] = useState(false);
    const initialSyncedRef = useRef(false); // evita sync duplicati

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

    React.useEffect(() => {
        // parti solo se ci sono credenziali valide e non stai già caricando
        const hasCreds = !!auth.siteUrl && !!auth.username && !!auth.password;
        if (!hasCreds) return;
        if (initialSyncedRef.current) return;         // già sincronizzato in questa sessione
        if (isUploading || isZipping) return;         // non disturbare un upload/blocco zip

        const run = async () => {
            try {
                setInitialSyncVisible(true);
                const cfg = resolveApiConfigFromAuth(auth);
                const serverItems = await fetchFilesList(cfg, 1, 1000, 'desc');

                // Local items che non sono sul server (uploading/failed/canceled)
                const localPending = files.filter(f =>
                    f.status === 'uploading' || f.status === 'failed' || f.status === 'canceled'
                );

                const merged = mergeByIdSorted([...serverItems], localPending);
                dispatch(setFiles(merged));
            } catch (e) {
                console.error('Initial sync failed', e);
                showSnack('Failed to load files from server');
            } finally {
                initialSyncedRef.current = true;
                setInitialSyncVisible(false);
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.siteUrl, auth.username, auth.password, isUploading, isZipping]);


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

    // TODO: possiamo eliminare ed usare showSnack anche su Android?
    const showToast = (message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
            // iOS/macOS: usa la tua Snackbar con timeout breve
            showSnack(message, undefined, undefined, 1500);
        }
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
            cfg = resolveApiConfigFromAuth(auth);
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
        console.debug('[beginUpload] informazioni del file:', input);
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
                const serverUrl: string | undefined =
                    typeof result.json?.url === 'string' ? result.json.url : undefined;

                const serverName: string | undefined = result.json?.file;
                const serverMime: string | undefined = result.json?.mime;
                const serverSize: number | undefined = Number(result.json?.size ?? result.json?.sizeBytes);
                // se ZIP locale, rimuovi dal device
                if (item.kind === 'zip' && item.localTempPath) {
                    try { await safeUnlink(item.localTempPath); } catch { }
                    dispatch(updateFile(item.id, {
                        status: 'uploaded',
                        progress: 100,
                        localTempPath: undefined,
                        ...(serverUrl ? { uri: serverUrl } : {}),
                        ...(serverName ? { name: serverName } : {}),
                        ...(serverMime ? { type: serverMime } : {}),
                        ...(Number.isFinite(serverSize) ? { size: serverSize as number } : {}),
                    }));
                } else {
                    dispatch(updateFile(item.id, {
                        status: 'uploaded',
                        progress: 100,
                        ...(serverUrl ? { uri: serverUrl } : {}),
                        ...(serverName ? { name: serverName } : {}),
                        ...(serverMime ? { type: serverMime } : {}),
                        ...(Number.isFinite(serverSize) ? { size: serverSize as number } : {}),
                    }));
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
        // Consenti il refresh anche durante upload: la UI è bloccante, ma teniamo la logica pronta
        setRefreshing(true);
        try {
            const cfg = resolveApiConfigFromAuth(auth);
            const serverItems = await fetchFilesList(cfg, 1, 1000, 'desc');

            const localPending = files.filter(f =>
                f.status === 'uploading' || f.status === 'failed' || f.status === 'canceled'
            );
            const merged = mergeByIdSorted([...serverItems], localPending);
            dispatch(setFiles(merged));
        } catch (e) {
            console.error('Refresh failed', e);
            showSnack('Refresh failed');
        } finally {
            setRefreshing(false);
        }
    };

    const handleLongPressCopy = async (item: FileItem) => {
        // prendiamo solo URL http/https (non i path locali file://)
        const url = item.uri?.startsWith('http') ? item.uri : undefined;

        if (!url) {
            showToast('No server URL available yet');
            return;
        }
        try {
            await Clipboard.setString(url);
            showToast('URL copied to clipboard');
        } catch (e) {
            console.error('Clipboard copy failed', e);
            showSnack('Could not copy URL');
        }
    };

    // --- Render ----------------------------------------------------------------

    const renderItem = ({ item }: { item: FileItem }) => (
        <FileListItem
            item={item}
            disabled={isUploading}
            onPress={() => navigation.navigate('Details', { id: item.id })}
            onDelete={() => confirmDelete(item)}
            onLongPress={() => handleLongPressCopy(item)}
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

            <BlockingLoaderModal visible={initialSyncVisible} message="Getting your files…" />

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
