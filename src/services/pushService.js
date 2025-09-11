const admin = require('firebase-admin');
let initialized = false;

// 🔗 (NOVO) Models usados para gating e badge
const Notification = require('../models/Notification');
const User = require('../models/User');
const DeviceToken = require('../models/DeviceToken');

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

  // 🧹 (NOVO) Limpa tokens inválidos/not-registered para manter a base saudável
  try {
    const invalidCodes = new Set(['messaging/invalid-argument', 'messaging/registration-token-not-registered']);
    await Promise.all(
      (res.responses || []).map(async (r, i) => {
        if (!r.success && r.error && invalidCodes.has(r.error.code)) {
          const bad = tokens[i];
          if (bad) {
            await DeviceToken.deleteOne({ token: bad }).catch(() => {});
          }
        }
      })
    );
  } catch (_) {}

  return res;
}

// ======================= (NOVO) Premium helpers =======================
function parseHm(hm = '22:00') {
  const [h, m] = String(hm).split(':').map(n => parseInt(n || '0', 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}
function nowInTz(tz = 'America/Sao_Paulo') {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
}
function isInsideQuietHours(qh = {}, tz) {
  if (!qh?.enabled) return false;
  const now = nowInTz(qh.timezone || tz || 'America/Sao_Paulo');
  const { h: sh, m: sm } = parseHm(qh.start || '22:00');
  const { h: eh, m: em } = parseHm(qh.end || '07:00');
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const minutesStart = sh * 60 + sm;
  const minutesEnd = eh * 60 + em;
  // janela pode cruzar a meia-noite
  if (minutesStart <= minutesEnd) {
    return minutesNow >= minutesStart && minutesNow < minutesEnd;
  } else {
    return minutesNow >= minutesStart || minutesNow < minutesEnd;
  }
}

/**
 * (NOVO) Envia push para um usuário respeitando:
 * - notificationPrefs.pushEnabled (global)
 * - notificationPrefs.channels[channel].push
 * - quietHours (com opção urgent para furar)
 * - badge iOS com contagem de não lidas
 *
 * @param {String} userId
 * @param {Object} opts { title, body, data, channel='system', urgent=false }
 */
async function sendUserPush(
  userId,
  { title, body, data = {}, channel = 'system', urgent = false } = {}
) {
  const user = await User.findById(userId).lean();
  if (!user) return { skipped: 'user_not_found' };

  const prefs = user.notificationPrefs || {};
  if (prefs.pushEnabled === false) return { skipped: 'push_disabled' };
  if (prefs.channels?.[channel]?.push === false) return { skipped: `channel_${channel}_disabled` };
  if (prefs.quietHours?.enabled && !urgent && isInsideQuietHours(prefs.quietHours)) {
    return { skipped: 'quiet_hours' };
  }

  const tokenDocs = await DeviceToken.find({ user: userId }).select('token -_id');
  const tokens = tokenDocs.map(t => t.token).filter(Boolean);
  if (!tokens.length) return { successCount: 0, failureCount: 0, tokens: 0 };

  // envia push normal
  const res = await sendToTokens(tokens, {
    title,
    body,
    data: { ...data, channel }
  });

  // badge iOS = total de não lidas
  try {
    ensureInit();
    const unread = await Notification.countDocuments({ userId, read: false });
    await Promise.all(
      tokens.map(token =>
        admin
          .messaging()
          .send({
            token,
            apns: { payload: { aps: { badge: unread, sound: 'default' } } },
            data: { __badgeOnly: '1' }
          })
          .catch(() => null)
      )
    );
  } catch (_) {}

  return res;
}

module.exports = { sendToTokens, sendUserPush };
