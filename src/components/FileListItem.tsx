import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { FileItem } from '@/src/types/file';

type Props = {
    item: FileItem;
    disabled?: boolean;
    onPress: () => void;
    onDelete: () => void;
    onLongPress?: () => void; // fallback to delete if not provided
};

export default function FileListItem({
    item,
    disabled,
    onPress,
    onDelete,
    onLongPress,
}: Props): React.JSX.Element {
    const swipeRef = useRef<Swipeable>(null);
    const close = () => swipeRef.current?.close();

    const RightActions = () => (
        <TouchableOpacity
            onPress={() => {
                close();
                onDelete();
            }}
            activeOpacity={0.9}
            style={styles.rightAction}
        >
            <Text style={styles.rightText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <Swipeable ref={swipeRef} renderRightActions={RightActions} overshootRight={false}>
            <TouchableOpacity
                style={styles.item}
                disabled={disabled}
                onPress={onPress}
                onLongPress={onLongPress ?? onDelete}
            >
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                    {item.type || 'unknown'} · {item.size ? `${item.size} bytes` : 'size N/A'}
                </Text>
                {item.status && (
                    <Text style={styles.badge}>
                        {item.status}{item.status === 'uploading' ? ` ${Math.round(item.progress ?? 0)}%` : ''}
                    </Text>
                )}
            </TouchableOpacity>
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    item: {
        backgroundColor: '#f7f7f8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    name: { fontSize: 16, fontWeight: '600', color: '#111' },
    meta: { marginTop: 4, fontSize: 12, color: '#666' },
    badge: { marginTop: 6, fontSize: 12, color: '#007aff', fontWeight: '600' },
    rightAction: {
        width: 96,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ff3b30',
        borderRadius: 12,
        marginBottom: 12,
        marginLeft: 8,
    },
    rightText: { color: '#fff', fontWeight: '700' },
});
