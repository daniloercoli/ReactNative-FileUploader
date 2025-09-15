// A simple floating action button with a plus sign.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface Props {
    onPress: () => void;
}

export default function FAB({ onPress }: Props): React.JSX.Element {
    return (
        <View pointerEvents="box-none" style={styles.wrapper}>
            <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.8}>
                <Text style={styles.plus}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const SIZE = 56;

const styles = StyleSheet.create({
    wrapper: { position: 'absolute', bottom: 24, right: 24 },
    fab: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: '#007aff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    plus: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: -2 },
});