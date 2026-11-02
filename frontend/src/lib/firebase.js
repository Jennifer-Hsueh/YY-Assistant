import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { isNative } from './platform';
import { requestNativePushToken, nativePushGranted } from './nativePush';

// These Firebase web config values are NOT secret — they're meant to be
// public (they identify the project to Google's servers; access control
// happens via Firebase security rules / backend auth, not by hiding these).
// Fill them in from Firebase Console → Project Settings → General → Your apps → Web app.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// The VAPID key is also public-safe; it's generated in
// Firebase Console → Project Settings → Cloud Messaging → Web configuration.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance = null;

async function getMessagingIfSupported() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const app = initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

// 網頁開著(在前景)時收到的推播:Firebase 不會自動跳出,要自己顯示通知
let foregroundAttached = false;
function attachForeground(messaging) {
  if (foregroundAttached) return;
  foregroundAttached = true;
  onMessage(messaging, async (payload) => {
    window.dispatchEvent(new Event('yy:push'));
    const { title, body } = payload.notification || {};
    const opts = { body: body || '', icon: '/icons/icon-192.png', data: payload.data };
    try {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
      if (reg) await reg.showNotification(title || 'YY手帳', opts);
      else new Notification(title || 'YY手帳', opts);
    } catch (err) {
      console.error('[firebase] foreground notification failed', err);
    }
  });
}

// 開啟網頁時:已經允許通知的話,先接上前景通知
export async function initForegroundPush() {
  if (isNative || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !firebaseConfig.apiKey) return;
  // 推播用的 service worker 不會自己更新(它的範圍沒有網頁會開),每次打開時主動檢查新版
  navigator.serviceWorker?.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
    .then((reg) => reg.update())
    .catch(() => {});
  const messaging = await getMessagingIfSupported();
  if (messaging) attachForeground(messaging);
}

// Requests notification permission (if not already granted/denied) and
// returns an FCM device token, or null if unsupported/denied/unconfigured.
export async function requestPushToken() {
  if (isNative) return requestNativePushToken();
  if (!firebaseConfig.apiKey) {
    console.warn('[firebase] VITE_FIREBASE_* env vars not set — push notifications disabled.');
    return null;
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    // 推播用獨立的範圍,不要蓋掉網頁本身的 service worker(否則會誤判為新版本)
    scope: '/firebase-cloud-messaging-push-scope',
  });

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) attachForeground(messaging);
    return token || null;
  } catch (err) {
    console.error('[firebase] Failed to get push token', err);
    return null;
  }
}

// 這台裝置是否已允許通知(網頁看瀏覽器權限,APP 看系統權限)
export async function pushPermissionGranted() {
  if (isNative) return nativePushGranted();
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
