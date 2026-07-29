const admin = require('firebase-admin');

// The service account JSON is provided as a base64-encoded string in
// FIREBASE_SERVICE_ACCOUNT_BASE64 (avoids committing a raw JSON key file
// and avoids multi-line .env headaches). Generate it with:
//   base64 -i serviceAccountKey.json | tr -d '\n'
// (Firebase Console → Project Settings → Service accounts → Generate new private key)

let app = null;

function getFirebaseApp() {
  if (app) return app;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 not set — push notifications will be logged, not sent.');
    return null;
  }

  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return app;
  } catch (err) {
    console.error('[firebase] Failed to initialize firebase-admin — check FIREBASE_SERVICE_ACCOUNT_BASE64', err);
    return null;
  }
}

module.exports = { getFirebaseApp, admin };
