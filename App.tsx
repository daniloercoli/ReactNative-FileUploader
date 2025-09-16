// Root component: wraps the app with Redux Provider, GestureHandlerRootView, and NavigationContainer
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useDispatch } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { hydrateAuth, setPassword } from './src/store/authReducer';
import { setFiles } from './src/store/filesReducer';
import { loadSettings, loadFiles, saveSettings } from '@/src/utils/storage';
import { loadSecurePassword, saveSecurePassword } from '@/src/utils/secure';
import {saveFiles} from '@/src/utils/storage';

function Bootstrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      // 1) Hydrate
      const [settings, files] = await Promise.all([loadSettings(), loadFiles()]);
      dispatch(hydrateAuth({ siteUrl: settings.siteUrl, username: settings.username, password: null }));
      dispatch(setFiles(files));

      // 2) Migrazione password legacy (se presente in AsyncStorage)
      if (settings.password) {
        await saveSecurePassword(settings.siteUrl, settings.username, settings.password);
        dispatch(setPassword(settings.password));
        // rimuovi la password dal settings persistito
        await saveSettings({ siteUrl: settings.siteUrl, username: settings.username, password: null });
      } else {
        // 3) Carica password dal Keychain/Keystore
        const pwd = await loadSecurePassword(settings.siteUrl);
        if (pwd) dispatch(setPassword(pwd));
      }
    })();

    // 4) Persist su cambi store (debounced)
    let t: ReturnType<typeof setTimeout> | null = null;
    let lastAuth = store.getState().auth;
    let lastFiles = store.getState().files.items;

    const unsub = store.subscribe(() => {
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        const state = store.getState();

        // salva solo siteUrl/username (NO password)
        if (state.auth.siteUrl !== lastAuth.siteUrl || state.auth.username !== lastAuth.username) {
          lastAuth = state.auth;
          await saveSettings({
            siteUrl: state.auth.siteUrl,
            username: state.auth.username,
            password: null, // non persistiamo
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