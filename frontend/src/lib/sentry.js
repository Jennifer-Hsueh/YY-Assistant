// 錯誤通知(Sentry):建置時有設定 VITE_SENTRY_DSN 才啟用(本機與 APP 版不會送出)
// 只送錯誤訊息與發生位置;不送使用者身分、輸入內容、點擊的文字
import * as Sentry from '@sentry/react';

const SENSITIVE_QUERY = /([?&](?:token|key|code|email)=)[^&]*/gi;
const scrub = (s) => (typeof s === 'string' ? s.replace(SENSITIVE_QUERY, '$1[已隱藏]') : s);

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: (defaults) => defaults.filter((i) => i.name !== 'Breadcrumbs').concat(Sentry.breadcrumbsIntegration({ dom: false, console: false })),
    // 瀏覽器外掛、網路斷線等不是程式問題的錯誤不送
    ignoreErrors: ['ResizeObserver loop', 'Failed to fetch', 'NetworkError', 'Load failed', '無法連線到伺服器'],
    beforeBreadcrumb(b) {
      if (b.data?.url) b.data.url = scrub(b.data.url);
      if (b.data?.from) b.data.from = scrub(b.data.from);
      if (b.data?.to) b.data.to = scrub(b.data.to);
      return b;
    },
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        event.request.url = scrub(event.request.url);
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers.Referer;
      }
      return event;
    },
  });
}

export { Sentry };
