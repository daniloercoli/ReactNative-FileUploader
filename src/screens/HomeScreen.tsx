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
    type DocumentPickerResponse,
} from '@react-native-documents/picker';
import { startMockUpload } from '@/src/utils/uploadMock';
import { impactLight, success as hapticSuccess } from '@/src/utils/haptics';
import { fetchFilesMock } from '@/src/utils/serverMock';
import { setFiles } from '@/src/store/filesReducer';


export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const dispatch = useAppDispatch();
    const files = useAppSelector(state => state.files.items);

    const [isUploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentName, setCurrentName] = useState<string | undefined>(undefined);

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

    const beginUpload = (item: FileItem) => {
        // Reset throttle refs for this (single) upload
        lastDispatchTsRef.current = 0;
        lastPctRef.current = 0;

        // Block UI and set modal info
        setUploading(true);
        setCurrentName(item.name);
        setProgress(0);
        currentUploadingIdRef.current = item.id;

        const cancel = startMockUpload(
            item,
            // onProgress (throttled Redux updates)
            (pct) => {
                setProgress(pct); // modal progress: update every tick (cheap)

                const now = Date.now();
                const bigEnoughDelta = pct - lastPctRef.current >= 5;
                const spacedEnough = now - lastDispatchTsRef.current >= 150;

                if (bigEnoughDelta || spacedEnough) {
                    lastPctRef.current = pct;
                    lastDispatchTsRef.current = now;
                    dispatch(updateFile(item.id, { progress: pct }));
                }
            },
            // onComplete
            () => {
                dispatch(updateFile(item.id, { status: 'uploaded', progress: 100 }));
                setUploading(false);
                setCurrentName(undefined);
                cancelUploadRef.current = null;
                currentUploadingIdRef.current = null;
                hapticSuccess(); // success haptic
            },
            // onError
            (err) => {
                console.error('Mock upload error', err);
                dispatch(updateFile(item.id, { status: 'failed' }));
                setUploading(false);
                setCurrentName(undefined);
                cancelUploadRef.current = null;
                currentUploadingIdRef.current = null;
                showSnack('Upload failed', 'RETRY', () => retryUpload(item.id));
            }
        );

        cancelUploadRef.current = cancel;
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
            const [pf] = await pick(); // single selection
            if (!pf) return;

            const fileItem = mapPickerToFileItem(pf);

            dispatch(addFile(fileItem));
            beginUpload(fileItem);
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
                onPress: () => {
                    dispatch(removeFile(item.id));
                    showSnack('File deleted', 'UNDO', () => {
                        dispatch(addFile(item)); // restore
                    });
                },
            },
        ]);
    };

    const onRefresh = async () => {
        // For now we allow refresh even during upload because the modal blocks UI.
        // In the future (non-blocking uploads) you may want to guard here or queue.
        setRefreshing(true);
        try {
            const serverItems = await fetchFilesMock();

            // Local items that are not on the server yet (e.g., uploading/failed/canceled or not synced)
            const localPending = files.filter(f =>
                f.status === 'uploading' || f.status === 'failed' || f.status === 'canceled'
            );

            // Merge: server list + local pending (local wins on same id)
            const merged = mergeByIdSorted([...serverItems], localPending);

            dispatch(setFiles(merged));
        } catch (e) {
            console.error('Refresh failed', e);
            // potresti mostrare una snackbar qui, se preferisci
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
