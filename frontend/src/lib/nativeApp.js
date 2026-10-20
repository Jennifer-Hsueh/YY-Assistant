// APP 啟動時的原生設定:狀態列、Android 返回鍵、點推播開啟對應頁面
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, platform, nativePushEnabled } from './platform';

export async function initNativeApp(navigate) {
  if (!isNative) return;
  document.documentElement.classList.add('native-app', `native-${platform}`);
  // APP 的畫面延伸到狀態列與底部,用安全區把內容往內推
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !vp.content.includes('viewport-fit')) vp.content += ', viewport-fit=cover';
  try { await StatusBar.setStyle({ style: Style.Light }); } catch { /* ignore */ }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== '/') window.history.back();
    else App.minimizeApp();
  });

  if (nativePushEnabled) {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      const to = notification?.data?.url;
      if (typeof to === 'string' && to.startsWith('/')) navigate(to);
    });
  }
}
