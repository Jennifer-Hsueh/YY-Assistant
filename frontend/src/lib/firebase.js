import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

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

// Requests notification permission (if not already granted/denied) and
// returns an FCM device token, or null if unsupported/denied/unconfigured.
export async function requestPushToken() {
  if (!firebaseConfig.apiKey) {
    console.warn('[firebase] VITE_FIREBASE_* env vars not set — push notifications disabled.');
    return null;
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error('[firebase] Failed to get push token', err);
    return null;
  }
}
