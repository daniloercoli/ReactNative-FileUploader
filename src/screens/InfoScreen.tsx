import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';

export default function InfoScreen(): React.JSX.Element {
  const handleEmailPress = async () => {
    const mailto = 'mailto:ercoli@gmail.com?subject=Private%20File%20Uploader%20Support';
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        await Linking.openURL(mailto);
      } else {
        Alert.alert('Email not available', 'Please configure a mail client on your device.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open your mail client.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About This App</Text>
      <Text style={styles.text}>
        Private File Uploader is a privacy-first mobile client to upload files directly to your own
        server. It pairs with a WordPress plugin using Application Passwords for authentication.
      </Text>

      <Text style={styles.sectionTitle}>Current Capabilities</Text>
      <Text style={styles.text}>
        • File list with swipe & long-press actions{'\n'}
        • Single and multi-file selection (bundle as on-device ZIP){'\n'}
        • Local “Preparing ZIP…” progress and separate upload progress{'\n'}
        • Retry/Cancel flows and pull-to-refresh{'\n'}
        • Settings with URL/username and secure password storage
      </Text>

      <Text style={styles.sectionTitle}>Server Component</Text>
      <Text style={styles.text}>
        A dedicated WordPress plugin provides secure REST endpoints and leverages native user
        management. The plugin and the real network layer will be released shortly.
      </Text>

      <Text style={styles.sectionTitle}>Developer</Text>
      <Text style={styles.text}>Danilo Ercoli</Text>
      <Pressable accessibilityRole="link" onPress={handleEmailPress} style={styles.linkWrap}>
        <Text style={styles.link}>ercoli@gmail.com</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>License</Text>
      <Text style={styles.text}>
        MIT License. See the LICENSE file in this repository for full text.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  text: { fontSize: 14, color: '#444', lineHeight: 20 },
  linkWrap: { marginTop: 2 },
  link: { fontSize: 14, color: '#007aff', textDecorationLine: 'underline' },
});
