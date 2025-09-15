// Info screen: simple placeholder for app info/help.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function InfoScreen(): React.JSX.Element {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>About This App</Text>
            <Text style={styles.text}>
                This app lets you upload files to your own server using WordPress Application Passwords.
                In upcoming iterations, we will enable picking files, showing upload progress, and more.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    text: { fontSize: 14, color: '#444', lineHeight: 20 },
});