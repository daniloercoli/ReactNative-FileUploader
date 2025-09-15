// Empty state shown when no files are present. Encourages the user to upload the first file.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
    onPressPrimary: () => void;
}

export default function EmptyState({ onPressPrimary }: Props): React.JSX.Element {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>No files yet</Text>
            <Text style={styles.body}>
                Tap the button below to select a file and upload it to your server.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={onPressPrimary}>
                <Text style={styles.btnText}>Upload your first file</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    body: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    btn: { backgroundColor: '#007aff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
    btnText: { color: '#fff', fontWeight: '600' },
});