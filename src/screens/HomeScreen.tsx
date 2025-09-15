import React, { useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Snackbar from '@/src/components/Snackbar';
import FAB from '@/src/components/FAB';
import EmptyState from '@/src/components/EmptyState';
import UploadProgressModal from '@/src/components/UploadProgressModal';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { addFile, removeFile, updateFile } from '@/src/store/filesReducer';
import type { RootStackParamList } from '@/src/navigation/types';
import type { FileItem } from '@/src/types/file';
import {
    pick,
    isErrorWithCode,
    errorCodes,
    type DocumentPickerResponse,
} from '@react-native-documents/picker';
import FileListItem from '@/src/components/FileListItem';
import { startMockUpload } from '@/src/utils/uploadMock';
import { impactLight } from '@/src/utils/haptics';

export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const dispatch = useAppDispatch();
    const files = useAppSelector(state => state.files.items);

    const [isUploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentName, setCurrentName] = useState<string | undefined>(undefined);

    const [snackVisible, setSnackVisible] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastDeletedRef = useRef<FileItem | null>(null);

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

    const mapPickerToFileItem = (pf: DocumentPickerResponse): FileItem => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: pf.name ?? 'Unnamed',
        uri: pf.uri,
        type: pf.type ?? 'application/octet-stream',
        size: pf.size ?? 0,
        status: 'uploading',
        progress: 0,
    });

    const handleAddPress = async () => {
        try {
            const [pf] = await pick(); // opzionale: { allowMultiSelection: false }
            if (!pf) return;

            const fileItem = mapPickerToFileItem(pf);
            setCurrentName(fileItem.name);
            setProgress(0);
            setUploading(true);

            // optimistic add
            dispatch(addFile(fileItem));

            // mock upload
            const cancel = startMockUpload(
                fileItem,
                (pct) => {
                    setProgress(pct);
                    dispatch(updateFile(fileItem.id, { progress: pct }));
                },
                () => {
                    dispatch(updateFile(fileItem.id, { status: 'uploaded', progress: 100 }));
                    setUploading(false);
                    setCurrentName(undefined);
                },
                (err) => {
                    console.error('Mock upload error', err);
                    dispatch(updateFile(fileItem.id, { status: 'failed' }));
                    setUploading(false);
                    setCurrentName(undefined);
                    Alert.alert('Upload failed', 'Something went wrong while uploading your file.');
                }
            );

            // In futuro potremmo esporre la cancel UI
            void cancel;
        } catch (e: any) {
            if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
                // utente ha annullato: esci silenziosamente
                return;
            }
            console.error(e);
            Alert.alert('Picker error', String((e as any)?.message ?? e));
        }
    };

    const confirmDelete = (item: FileItem) => {
        impactLight(); // haptic immediato al long-press
        Alert.alert('Delete file', `Delete “${item.name}”?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    // salva l'oggetto completo per ripristino
                    lastDeletedRef.current = item;
                    // rimuovi dallo store
                    dispatch(removeFile(item.id));
                    // mostra snackbar con undo; se scade, svuota il ref
                    showUndoSnack('File deleted', () => {
                        lastDeletedRef.current = null;
                    });
                },
            },
        ]);
    };

    const showUndoSnack = (message: string, onTimeout: () => void) => {
        // cancella eventuale timer precedente
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setSnackMsg(message);
        setSnackVisible(true);
        // 4s di tempo per l'undo
        undoTimerRef.current = setTimeout(() => {
            setSnackVisible(false);
            undoTimerRef.current = null;
            onTimeout();
        }, 4000);
    };

    const handleUndo = () => {
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setSnackVisible(false);

        const deleted = lastDeletedRef.current;
        if (deleted) {
            // re-add in cima
            dispatch(addFile(deleted));
            lastDeletedRef.current = null;
        }
    };


    const renderItem = ({ item }: { item: FileItem }) => (
        <FileListItem
            item={item}
            disabled={isUploading}
            onPress={() => navigation.navigate('Details', { id: item.id })}
            onDelete={() => confirmDelete(item)}
            onLongPress={() => confirmDelete(item)}
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

            <UploadProgressModal visible={isUploading} progress={progress} filename={currentName} />
            <Snackbar
                visible={snackVisible}
                message={snackMsg}
                actionLabel="UNDO"
                onAction={handleUndo}
                onDismiss={() => setSnackVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    listContent: { padding: 16 },
    item: {
        backgroundColor: '#f7f7f8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    itemName: { fontSize: 16, fontWeight: '600', color: '#111' },
    itemMeta: { marginTop: 4, fontSize: 12, color: '#666' },
    badge: { marginTop: 6, fontSize: 12, color: '#007aff', fontWeight: '600' },
    headerRightRow: { flexDirection: 'row' },
    headerBtn: { marginLeft: 12, paddingVertical: 6, paddingHorizontal: 8 },
    headerBtnText: { color: '#007aff', fontSize: 15, fontWeight: '500' },
    disabled: { opacity: 0.4 },
});
