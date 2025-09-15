// Native stack navigator defining our screens
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '@/src/screens/HomeScreen';
import DetailsScreen from '@/src/screens/DetailsScreen';
import SettingsScreen from '@/src/screens/SettingsScreen';
import InfoScreen from '@/src/screens/InfoScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
    return (
        <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Files' }} />
            <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'File Details' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Info" component={InfoScreen} />
        </Stack.Navigator>
    );
}