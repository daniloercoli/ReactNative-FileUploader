import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/src/navigation/types';
import {useAppSelector} from '@/src/store/hooks';
import {isImage} from '@/src/utils/mime';

export type DetailsProps = NativeStackScreenProps<RootStackParamList, 'Details'>;

export default function DetailsScreen({route}: DetailsProps): React.JSX.Element {
  const {id} = route.params;
  const file = useAppSelector(state => state.files.items.find(f => f.id === id));

  if (!file) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>File not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{file.name}</Text>
      <Text style={styles.meta}>Type: {file.type || 'unknown'}</Text>
      <Text style={styles.meta}>Size: {file.size ? `${file.size} bytes` : 'N/A'}</Text>
      <Text style={styles.meta}>Status: {file.status || 'uploaded'}</Text>
      {isImage(file.type) && (
        <Image
          source={{uri: file.uri}}
          resizeMode="contain"
          style={{width: '100%', height: 240, marginTop: 12, backgroundColor: '#fafafa', borderRadius: 8}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff', padding: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  muted: {color: '#777'},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 8},
  meta: {fontSize: 14, color: '#444', marginTop: 4},
});
