// Root component: wraps the app with Redux Provider, GestureHandlerRootView, and NavigationContainer
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';


export default function App() {
  return (
    <Provider store={store}>
      {/* GestureHandlerRootView ensures gesture components work reliably */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
    </Provider>
  );
}