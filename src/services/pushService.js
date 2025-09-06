const admin = require('firebase-admin');
let initialized = false;

// Inicializa o Firebase Admin 1x
function ensureInit() {
  if (initialized) return;
  // Opção A) GOOGLE_APPLICATION_CREDENTIALS=/caminho/cred.json
  // Opção B) Colocar o JSON do service account em process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else {
      admin.initializeApp(); // usa GOOGLE_APPLICATION_CREDENTIALS
    }
  }
  initialized = true;
}

async function sendToTokens(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };
  ensureInit();

  // message “multicast”
  const message = {
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])), // data precisa ser string
    android: {
      notification: { channelId: 'default', priority: 'high', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  const res = await admin.messaging().sendEachForMulticast(message);
  return res;
}

module.exports = { sendToTokens };
