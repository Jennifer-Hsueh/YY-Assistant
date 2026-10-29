// 錯誤通知(Sentry):有設定 SENTRY_DSN 才啟用(本機與測試不會送出)
// 只送錯誤訊息與發生位置;不送請求內容、Cookie、登入憑證、使用者身分
const Sentry = require('@sentry/node');

const SENSITIVE_QUERY = /([?&](?:token|key|code|email)=)[^&]*/gi;
const scrub = (s) => (typeof s === 'string' ? s.replace(SENSITIVE_QUERY, '$1[已隱藏]') : s);

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(b) {
      // console 紀錄可能含 Email 等資料,不送
      if (b.category === 'console') return null;
      if (b.data?.url) b.data.url = scrub(b.data.url);
      return b;
    },
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          for (const h of Object.keys(event.request.headers)) {
            if (/authorization|cookie|x-ledger/i.test(h)) delete event.request.headers[h];
          }
        }
        event.request.url = scrub(event.request.url);
        if (typeof event.request.query_string === 'string') event.request.query_string = scrub(`?${event.request.query_string}`).slice(1);
        else delete event.request.query_string;
      }
      return event;
    },
  });

  // 各 API 的 try/catch 都用 console.error 記錄錯誤(例如 [xxxController.yyy] Error);
  // 這裡順便把帶有 Error 物件的紀錄送到 Sentry,不必逐一修改
  const original = console.error.bind(console);
  console.error = (...args) => {
    original(...args);
    const err = args.find((a) => a instanceof Error || (a && typeof a === 'object' && typeof a.message === 'string' && (a.code || a.details || a.hint)));
    if (!err) return;
    const where = typeof args[0] === 'string' ? args[0] : undefined;
    const e = err instanceof Error ? err : Object.assign(new Error(err.message), { code: err.code });
    Sentry.withScope((scope) => {
      if (where) scope.setTag('where', where.slice(0, 120));
      if (err.code) scope.setTag('code', String(err.code));
      Sentry.captureException(e);
    });
  };
}

module.exports = Sentry;
