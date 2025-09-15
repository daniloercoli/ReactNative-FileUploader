// Settings: allows the user to set an Application Password stored in Redux.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setPassword } from '@/src/store/authReducer';


export default function SettingsScreen(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const current = useAppSelector(state => state.auth.password) || '';
    const [value, setValue] = useState<string>(current);


    const onSave = () => {
        // In a future iteration, consider secure storage; for now it's plain Redux state
        const trimmed = value.trim();
        dispatch(setPassword(trimmed.length ? trimmed : null));
        Alert.alert('Saved', 'Application Password updated.');
    };


    return (
        <View style={styles.container}>
            <Text style={styles.label}>Application Password</Text>
            <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="Enter your Application Password"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
            />
            <TouchableOpacity style={styles.btn} onPress={onSave}>
                <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <Text style={styles.note}>
                This credential will be attached to upload requests to authenticate with your server.
            </Text>
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    label: { fontSize: 14, color: '#444', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
    btn: { marginTop: 16, backgroundColor: '#007aff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '600' },
    note: { marginTop: 12, color: '#666', fontSize: 12 },
});