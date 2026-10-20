// APP 版推播:用 Firebase 原生 SDK 取得 FCM token(Android 與 iOS 都是 FCM token,後端照常發送)
import { nativePushEnabled } from './platform';

export async function nativePushGranted() {
  if (!nativePushEnabled) return false;
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  const { receive } = await FirebaseMessaging.checkPermissions();
  return receive === 'granted';
}

export async function requestNativePushToken() {
  if (!nativePushEnabled) return null;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted') ({ receive } = await FirebaseMessaging.requestPermissions());
    if (receive !== 'granted') return null;
    const { token } = await FirebaseMessaging.getToken();
    return token || null;
  } catch (err) {
    console.error('[nativePush] failed to get token', err);
    return null;
  }
}
