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

export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const dispatch = useAppDispatch();
    const files = useAppSelector(state => state.files.items);

    const [isUploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentName, setCurrentName] = useState<string | undefined>(undefined);

    // Snackbar state (generic): message + action
    const [snackVisible, setSnackVisible] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const [snackActionLabel, setSnackActionLabel] = useState<string | undefined>(undefined);
    const snackActionRef = useRef<(() => void) | undefined>(undefined);
    const snackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Upload control refs
    const cancelUploadRef = useRef<(() => void) | null>(null);
    const currentUploadingIdRef = useRef<string | null>(null);

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
        if (fn) fn();
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
        // Block UI and set modal info
        setUploading(true);
        setCurrentName(item.name);
        setProgress(0);
        currentUploadingIdRef.current = item.id;

        // Start mock
        const cancel = startMockUpload(
            item,
            (pct) => {
                setProgress(pct);
                dispatch(updateFile(item.id, { progress: pct }));
            },
            () => {
                dispatch(updateFile(item.id, { status: 'uploaded', progress: 100 }));
                setUploading(false);
                setCurrentName(undefined);
                cancelUploadRef.current = null;
                currentUploadingIdRef.current = null;
                hapticSuccess(); // success haptic
            },
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
        if (isUploading) {
            Alert.alert('Upload in progress', 'Please wait until the current upload finishes.');
            return;
        }
        const existing = files.find(f => f.id === id);
        if (!existing) return;
        // Reset status locally and re-begin
        dispatch(updateFile(id, { status: 'uploading', progress: 0 }));
        beginUpload({ ...existing, status: 'uploading', progress: 0 });
    };

    // --- Handlers --------------------------------------------------------------

    const handleAddPress = async () => {
        try {
            const [pf] = await pick(); // single selection
            if (!pf) return;

            const fileItem = mapPickerToFileItem(pf);

            // optimistic add then begin upload
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
        // stop mock
        cancelUploadRef.current?.();
        cancelUploadRef.current = null;

        const id = currentUploadingIdRef.current;
        if (id) {
            dispatch(updateFile(id, { status: 'canceled' }));
            // Offer retry via snackbar
            showSnack('Upload canceled', 'RETRY', () => retryUpload(id));
        }
        currentUploadingIdRef.current = null;

        setUploading(false);
        setCurrentName(undefined);
        setProgress(0);
    };

    const confirmDelete = (item: FileItem) => {
        impactLight(); // haptic immediato al long-press
        Alert.alert('Delete file', `Delete “${item.name}”?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    dispatch(removeFile(item.id));
                    showSnack('File deleted', 'UNDO', () => {
                        // re-add with same data
                        dispatch(addFile(item));
                    });
                },
            },
        ]);
    };

    // --- Render ----------------------------------------------------------------

    const renderItem = ({ item }: { item: FileItem }) => (
        <FileListItem
            item={item}
            disabled={isUploading}
            onPress={() => navigation.navigate('Details', { id: item.id })}
            onDelete={() => confirmDelete(item)}
            onLongPress={() => confirmDelete(item)}
            onRetry={() => retryUpload(item.id)} // <-- NEW
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
