import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  ToastAndroid,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/src/navigation/types';
import { useAppSelector } from '@/src/store/hooks';
import { isImage } from '@/src/utils/mime';
import { formatBytes } from '@/src/utils/fs';
import {isHttpUrl} from '@/src/utils/validation'

export type DetailsProps = NativeStackScreenProps<RootStackParamList, 'Details'>;

function formatDate(ms?: number): string {
  if (!ms) return 'N/A';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return 'N/A';
  }
}

export default function DetailsScreen({ route }: DetailsProps): React.JSX.Element {
  const { id } = route.params;
  const file = useAppSelector(state => state.files.items.find(f => f.id === id));

  if (!file) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>File not found.</Text>
      </View>
    );
  }

  const canCopyUrl = isHttpUrl(file.uri);

  const handleCopyUrl = async () => {
    if (!canCopyUrl || !file.uri) return;
    try {
      await Clipboard.setString(file.uri);
      if (Platform.OS === 'android') {
        ToastAndroid.show('URL copied to clipboard', ToastAndroid.SHORT);
      } else {
        // su iOS riutilizziamo una notifica minima a schermo
        // (se preferisci, puoi usare la tua Snackbar esistente)
      }
    } catch (e) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Copy failed', ToastAndroid.SHORT);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} numberOfLines={2}>{file.name}</Text>

        <View style={styles.metaBlock}>
          <MetaRow label="Type" value={file.type || 'unknown'} />
          <MetaRow label="Size" value={formatBytes(file.size)} />
          <MetaRow label="Status" value={file.status ?? 'uploaded'} />
          {typeof file.progress === 'number' && (
            <MetaRow label="Progress" value={`${Math.round(file.progress)}%`} />
          )}
          <MetaRow label="Created" value={formatDate(file.createdAt)} />
          {file.kind && <MetaRow label="Kind" value={file.kind} />}
          {typeof file.bundleCount === 'number' && (
            <MetaRow label="Bundle count" value={String(file.bundleCount)} />
          )}
          {file.localTempPath && (
            <MetaRow label="Local temp" value={file.localTempPath} mono />
          )}
          <MetaRow label="Current URI" value={file.uri || 'N/A'} mono />
        </View>

        {isImage(file.type) && isHttpUrl(file.uri) && (
          <Image
            source={{ uri: file.uri as string }}
            resizeMode="contain"
            style={styles.preview}
          />
        )}
        {isImage(file.type) && !isHttpUrl(file.uri) && (
          <Text style={styles.note}>
            Image preview is only shown for server URLs. This item currently has a local URI.
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !canCopyUrl && styles.buttonDisabled]}
          onPress={handleCopyUrl}
          disabled={!canCopyUrl}
        >
          <Text style={styles.buttonText}>
            {canCopyUrl ? 'Copy link' : 'No server URL'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.mono]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#777' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#111' },

  metaBlock: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
    marginBottom: 12,
  },
  row: { marginBottom: 8 },
  metaLabel: { fontSize: 12, color: '#666' },
  metaValue: { fontSize: 14, color: '#222', marginTop: 2 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },

  preview: {
    width: '100%',
    height: 260,
    marginTop: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },

  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  button: {
    backgroundColor: '#007aff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#b7cdf7' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  note: { fontSize: 12, color: '#666', marginTop: 8 },
});
