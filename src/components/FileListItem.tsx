import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { FileItem } from '@/src/types/file';

type Props = {
    item: FileItem;
    disabled?: boolean;
    onPress: () => void;
    onDelete: () => void;
    onLongPress?: () => void;
    onRetry?: () => void; // <-- NEW
};

export default function FileListItem({
    item,
    disabled,
    onPress,
    onDelete,
    onLongPress,
    onRetry,
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

    const showRetry = (item.status === 'failed' || item.status === 'canceled') && !!onRetry;

    return (
        <Swipeable ref={swipeRef} renderRightActions={RightActions} overshootRight={false}>
            <TouchableOpacity
                style={styles.item}
                disabled={disabled}
                onPress={onPress}
                onLongPress={onLongPress ?? onDelete}
            >
                <Text style={styles.name}>{item.name}</Text>
                {item.kind === 'zip' && item.bundleCount ? (
                    <Text style={[styles.meta, { marginTop: 2 }]}>
                        Bundle: {item.bundleCount} file{item.bundleCount > 1 ? 's' : ''}
                    </Text>
                ) : null}
                <Text style={styles.meta}>
                    {item.type || 'unknown'} · {item.size ? `${item.size} bytes` : 'size N/A'}
                </Text>
                {item.status && (
                    <View style={styles.row}>
                        <Text style={styles.badge}>
                            {item.status}
                            {item.status === 'uploading' ? ` ${Math.round(item.progress ?? 0)}%` : ''}
                        </Text>
                        {showRetry && !disabled ? (
                            <TouchableOpacity onPress={onRetry} style={styles.retryBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={styles.retryText}>Retry</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
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
    row: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: { fontSize: 12, color: '#007aff', fontWeight: '600' },
    retryBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#e7f0ff' },
    retryText: { color: '#007aff', fontWeight: '700' },
    rightAction: {
        width: 96, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#ff3b30', borderRadius: 12, marginBottom: 12, marginLeft: 8,
    },
    rightText: { color: '#fff', fontWeight: '700' },
});
