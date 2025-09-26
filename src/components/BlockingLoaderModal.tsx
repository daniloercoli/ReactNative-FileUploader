import React from 'react';
import { Modal, View, ActivityIndicator, Text, StyleSheet } from 'react-native';

type Props = {
    visible: boolean;
    message?: string;
};

export default function BlockingLoaderModal({ visible, message }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.text}>{message ?? 'Loading…'}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center', justifyContent: 'center',
    },
    card: {
        backgroundColor: '#fff', borderRadius: 12, padding: 20, minWidth: 220,
        alignItems: 'center',
    },
    text: { marginTop: 10, fontSize: 15, color: '#333', textAlign: 'center' },
});
