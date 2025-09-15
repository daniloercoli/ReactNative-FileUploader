import React from 'react';
import {Modal, View, Text, StyleSheet, ActivityIndicator} from 'react-native';

type Props = {
  visible: boolean;
  progress: number; // 0..100
  filename?: string;
};

export default function UploadProgressModal({visible, progress, filename}: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" />
          <Text style={styles.title}>Uploading…</Text>
          {!!filename && <Text style={styles.subtitle} numberOfLines={1}>{filename}</Text>}
          <Text style={styles.progress}>{Math.round(progress)}%</Text>
          <Text style={styles.note}>Please wait until the upload completes.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center'},
  card: {width: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center'},
  title: {marginTop: 12, fontSize: 18, fontWeight: '700'},
  subtitle: {marginTop: 4, fontSize: 14, color: '#444', maxWidth: '100%'},
  progress: {marginTop: 8, fontSize: 16, fontWeight: '600'},
  note: {marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center'},
});
