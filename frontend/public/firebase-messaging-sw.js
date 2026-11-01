// Handles push notifications that arrive while the app is NOT in the
// foreground (browser closed / tab in background). Firebase requires this
// as a separate, statically-served service worker (it can't be bundled
// through Vite, so the config values below must be filled in by hand and
// kept in sync with the VITE_FIREBASE_* values in your .env file).
//
// Uses the "compat" SDK via importScripts because service workers loaded
// this way can't use ES module imports without extra build tooling.

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// TODO: fill these in to match frontend/.env's VITE_FIREBASE_* values.
firebase.initializeApp({
  apiKey: 'AIzaSyCQwnhe-mJThSHnonhVNP-XaNsl0k0l26c',
  authDomain: 'yy-assistant-ff5e2.firebaseapp.com',
  projectId: 'yy-assistant-ff5e2',
  storageBucket: 'yy-assistant-ff5e2.firebasestorage.app',
  messagingSenderId: '548187287239',
  appId: '1:548187287239:web:ad282f60f1bbc766e618e2',
});

const messaging = firebase.messaging();

// 後端送的推播都帶 notification 欄位,瀏覽器在背景時 Firebase 會自動顯示;
// 這裡只處理沒有 notification 欄位的訊息,避免同一則通知跳兩次
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const { title, body } = payload.data || {};
  if (!title && !body) return;
  self.registration.showNotification(title || 'YY手帳', {
    body: body || '',
    icon: '/icons/icon-192.png',
    data: payload.data,
  });
});
