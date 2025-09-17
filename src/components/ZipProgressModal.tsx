import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';

type Props = {
    visible: boolean;
    progress: number; // 0..100
    count?: number;
};

export default function ZipProgressModal({ visible, progress, count }: Props): React.JSX.Element {
    const pct = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { }}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>Preparing ZIP…</Text>
                    {typeof count === 'number' ? (
                        <Text style={styles.subtitle}>Bundling {count} file{count === 1 ? '' : 's'}</Text>
                    ) : null}
                    <View style={styles.bar}>
                        <View style={[styles.fill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.percent}>{pct}%</Text>
                    <Text style={styles.note}>This is a local operation (no network yet).</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    card: { width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 18, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700' },
    subtitle: { marginTop: 4, fontSize: 14, color: '#444' },
    bar: { marginTop: 14, width: '100%', height: 10, borderRadius: 8, backgroundColor: '#eee', overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: '#007aff' },
    percent: { marginTop: 8, fontSize: 14, fontWeight: '600' },
    note: { marginTop: 6, fontSize: 12, color: '#666', textAlign: 'center' },
});
