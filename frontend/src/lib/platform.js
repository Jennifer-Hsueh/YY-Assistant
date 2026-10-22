import { Capacitor } from '@capacitor/core';

// 是否在 APP(Capacitor)裡執行;網頁版為 false
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'
export const isIOSApp = platform === 'ios';
// APP(iOS 與 Android)依 App Store 與 Google Play 規定不顯示價格與 App 外付款說明;網頁版照常顯示
export const hidePricing = isNative;
// APP 的推播需要 Firebase 設定檔;建置時沒有設定檔就關閉(避免 APP 閃退)
export const nativePushEnabled = isNative && import.meta.env.VITE_NATIVE_PUSH === '1';
