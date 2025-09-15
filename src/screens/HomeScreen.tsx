// Home screen: header with Info/Settings buttons, empty state list, and a floating "+" button.
import React, { useLayoutEffect } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FAB from '@/src/components/FAB';
import EmptyState from '@/src/components/EmptyState';
import { useAppSelector } from '@/src/store/hooks';
import type { RootStackParamList } from '@/src/navigation/types';
import type { FileItem } from '@/src/types/file';


export default function HomeScreen(): React.JSX.Element {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const files = useAppSelector(state => state.files.items);


    // Configure header buttons (Info + Settings) when the screen is mounted
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={styles.headerRightRow}>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Info')}>
                        <Text style={styles.headerBtnText}>Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings')}>
                        <Text style={styles.headerBtnText}>Settings</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation]);


    // Placeholder press handler for the FAB; will open the picker in the next iteration
    const handleAddPress = () => {
        // Next iteration: open file picker modal and start mocked upload
        console.log('FAB pressed: will open picker in next iteration');
    };


    const renderItem = ({ item }: { item: FileItem }) => (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('Details', { id: item.id })}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.type || 'unknown'} · {item.size ? `${item.size} bytes` : 'size N/A'}</Text>
        </TouchableOpacity>
    );


    const keyExtractor = (item: FileItem) => item.id;


    return (
        <View style={styles.container}>
            {files.length === 0 ? (
                <EmptyState onPressPrimary={handleAddPress} />
            ) : (
                <FlatList
                    data={files}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                />
            )}


            {/* Floating Action Button to add a file */}
            <FAB onPress={handleAddPress} />
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    listContent: { padding: 16 },
    item: {
        backgroundColor: '#f7f7f8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    itemName: { fontSize: 16, fontWeight: '600', color: '#111' },
    itemMeta: { marginTop: 4, fontSize: 12, color: '#666' },
    headerRightRow: { flexDirection: 'row' },
    headerBtn: { marginLeft: 12, paddingVertical: 6, paddingHorizontal: 8 },
    headerBtnText: { color: '#007aff', fontSize: 15, fontWeight: '500' },
});