// src/components/Snackbar.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
    visible: boolean;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    onDismiss?: () => void;
};

/**
 * Minimal bottom snackbar: slides up/down, with optional action button.
 * The parent component gestisce la durata/timeout.
 */
export default function Snackbar({
    visible,
    message,
    actionLabel,
    onAction,
    onDismiss,
}: Props): React.JSX.Element {
    const translateY = useRef(new Animated.Value(80)).current; // start hidden

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: visible ? 0 : 80,
            duration: 180,
            easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished && !visible) onDismiss?.();
        });
    }, [visible, translateY, onDismiss]);

    return (
        <View pointerEvents="box-none" style={styles.wrapper}>
            <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
                <Text style={styles.text} numberOfLines={2}>{message}</Text>
                {actionLabel ? (
                    <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.action}>{actionLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' },
    container: {
        maxWidth: 560,
        marginHorizontal: 16,
        backgroundColor: '#111',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    text: { color: '#fff', flexShrink: 1 },
    action: { color: '#4da3ff', fontWeight: '700' },
});
