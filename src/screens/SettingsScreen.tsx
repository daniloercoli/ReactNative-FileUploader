import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setPassword, setUsername, setSiteUrl } from '@/src/store/authReducer';
import { resetApp } from '@/src/store';
import { clearAll } from '@/src/utils/storage';

export default function SettingsScreen(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const { siteUrl: curUrl, username: curUser, password: curPass } = useAppSelector(s => s.auth);

    const [siteUrl, setSiteUrlLocal] = useState(curUrl ?? '');
    const [username, setUsernameLocal] = useState(curUser ?? '');
    const [password, setPasswordLocal] = useState(curPass ?? '');

    const onSave = () => {
        const url = siteUrl.trim() || null;
        const user = username.trim() || null;
        const pass = password.trim() || null;
        dispatch(setSiteUrl(url));
        dispatch(setUsername(user));
        dispatch(setPassword(pass));
        Alert.alert('Saved', 'Settings updated.');
    };

    const onResetAll = () => {
        Alert.alert(
            'Reset app',
            'This will clear credentials and local file list. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        // clear storage + redux
                        await clearAll();
                        dispatch(resetApp());
                        // reset local inputs
                        setSiteUrlLocal('');
                        setUsernameLocal('');
                        setPasswordLocal('');
                        Alert.alert('Done', 'App has been reset.');
                    },
                },
            ],
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Site URL</Text>
            <TextInput
                value={siteUrl}
                onChangeText={setSiteUrlLocal}
                placeholder="https://your-site.example"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
                value={username}
                onChangeText={setUsernameLocal}
                placeholder="your-username"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
            />

            <Text style={styles.label}>Application Password</Text>
            <TextInput
                value={password}
                onChangeText={setPasswordLocal}
                placeholder="Enter your Application Password"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={onSave}>
                <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnDanger} onPress={onResetAll}>
                <Text style={styles.btnDangerText}>Reset app</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
                These credentials will be used to authenticate upload requests to your server.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    label: { fontSize: 14, color: '#444', marginTop: 12, marginBottom: 6 },
    input: {
        borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16,
    },
    btnPrimary: {
        marginTop: 16, backgroundColor: '#007aff', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    },
    btnPrimaryText: { color: '#fff', fontWeight: '600' },
    btnDanger: {
        marginTop: 12, backgroundColor: '#ffecec', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    },
    btnDangerText: { color: '#ff3b30', fontWeight: '700' },
    note: { marginTop: 12, color: '#666', fontSize: 12 },
});
