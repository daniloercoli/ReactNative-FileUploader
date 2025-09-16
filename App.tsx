// Root component: wraps the app with Redux Provider, GestureHandlerRootView, and NavigationContainer
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useDispatch } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { hydrateAuth } from './src/store/authReducer';
import { setFiles } from './src/store/filesReducer';
import { loadSettings, loadFiles, saveSettings, saveFiles } from '@/src/utils/storage';

function Bootstrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  useEffect(() => {
    // 1) Hydrate from storage
    (async () => {
      const [settings, files] = await Promise.all([loadSettings(), loadFiles()]);
      dispatch(hydrateAuth(settings));
      dispatch(setFiles(files));
    })();

    // 2) Persist on store changes (debounced)
    let t: ReturnType<typeof setTimeout> | null = null;
    let lastAuth = store.getState().auth;
    let lastFiles = store.getState().files.items;

    const unsub = store.subscribe(() => {
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        const state = store.getState();
        if (state.auth !== lastAuth) {
          lastAuth = state.auth;
          await saveSettings({
            siteUrl: state.auth.siteUrl,
            username: state.auth.username,
            password: state.auth.password,
          });
        }
        if (state.files.items !== lastFiles) {
          lastFiles = state.files.items;
          await saveFiles(state.files.items);
        }
      }, 200);
    });

    return () => {
      if (t) clearTimeout(t);
      unsub();
    };
  }, [dispatch]);

  return <>{children}</>;
}

export default function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Bootstrapper>
            <AppNavigator />
          </Bootstrapper>
        </NavigationContainer>
      </GestureHandlerRootView>
    </Provider>
  );
}