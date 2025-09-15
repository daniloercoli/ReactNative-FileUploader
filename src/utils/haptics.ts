import {Platform, Vibration} from 'react-native';

/**
 * Lightweight haptic feedback without extra native deps.
 * On iOS this triggers the default vibration (no fine-grained Taptic Engine).
 * For richer patterns, consider a dedicated lib later.
 */
export function impactLight() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate(50); // iOS supports a single fixed vibration
  } else {
    Vibration.vibrate(10); // short tick on Android
  }
}