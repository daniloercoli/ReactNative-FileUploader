import React from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';

type Props = {
    visible: boolean;
    progress: number; // 0..100
    filename?: string;
    onCancel?: () => void;         // <-- NEW
    cancelText?: string;           // <-- NEW (default: "Cancel")
};

export default function UploadProgressModal({
    visible,
    progress,
    filename,
    onCancel,
    cancelText = 'Cancel',
}: Props): React.JSX.Element {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { }}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.title}>Uploading…</Text>
                    {!!filename && <Text style={styles.subtitle} numberOfLines={1}>{filename}</Text>}
                    <Text style={styles.progress}>{Math.round(progress)}%</Text>
                    <Text style={styles.note}>Please wait until the upload completes.</Text>

                    {onCancel ? (
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                            <Text style={styles.cancelText}>{cancelText}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    card: { width: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
    title: { marginTop: 12, fontSize: 18, fontWeight: '700' },
    subtitle: { marginTop: 4, fontSize: 14, color: '#444', maxWidth: '100%' },
    progress: { marginTop: 8, fontSize: 16, fontWeight: '600' },
    note: { marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' },
    cancelBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#eee' },
    cancelText: { color: '#111', fontWeight: '600' },
});
