const admin = require('firebase-admin');

// Firebase 服務帳戶金鑰放在 Render 的 FIREBASE_SERVICE_ACCOUNT_BASE64。
// 可以填 base64(base64 -w0 key.json 的結果),也可以直接貼整個 JSON 檔的內容;
// 前後空白、換行會自動去掉。
// (Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰)

let app = null;

// 把設定值解析成金鑰物件;失敗時回傳原因(不含金鑰內容)
function parseServiceAccount(raw) {
  const text = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
  if (!text) return { error: 'empty' };
  let json = null;
  if (text.startsWith('{')) {
    json = text; // 直接貼 JSON
  } else {
    const decoded = Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
    if (!decoded.startsWith('{')) return { error: 'not base64 of a JSON file (check the copied text is complete)' };
    json = decoded;
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    return { error: 'JSON is incomplete (the copied text was probably cut off)' };
  }
  const missing = ['project_id', 'client_email', 'private_key'].filter((k) => !obj[k]);
  if (missing.length) return { error: `not a service account key (missing ${missing.join(', ')})` };
  // 有些地方會把換行存成 \n 字面文字
  obj.private_key = String(obj.private_key).replace(/\\n/g, '\n');
  return { obj };
}

function getFirebaseApp() {
  if (app) return app;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 not set — push notifications will be logged, not sent.');
    return null;
  }

  const { obj, error } = parseServiceAccount(encoded);
  if (error) {
    console.error(`[firebase] Failed to initialize firebase-admin — ${error}`);
    return null;
  }
  try {
    app = admin.initializeApp({ credential: admin.credential.cert(obj) });
    console.log(`[firebase] ready (project ${obj.project_id})`);
    return app;
  } catch (err) {
    console.error(`[firebase] Failed to initialize firebase-admin — ${err.code || err.message}`);
    return null;
  }
}

module.exports = { getFirebaseApp, admin, parseServiceAccount };
