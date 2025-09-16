import { Platform, Vibration } from 'react-native';

/**
 * Lightweight haptic feedback without extra native deps.
 * On iOS this triggers the default vibration (no fine-grained Taptic Engine).
 * For richer patterns, consider a dedicated lib later.
 */
export function impactLight() {
    try {
        if (Platform.OS === 'ios') {
            Vibration.vibrate(50); // iOS supports a single fixed vibration
        } else {
            Vibration.vibrate(10); // short tick on Android
        }
    } catch {
        // Silently ignore if not allowed / not available
    }
}

export function success() {
    try {
        // Short celebratory pattern on Android; iOS will collapse to a single vibration.
        if (Platform.OS === 'android') {
            Vibration.vibrate([0, 20, 40, 20]);
        } else {
            Vibration.vibrate(60);
        }
    } catch {
        // Silently ignore if not allowed / not available
    }
}