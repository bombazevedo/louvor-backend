const admin = require('firebase-admin');
let initialized = false;

// 🔗 (NOVO) Models usados para gating e badge
const https = require('https'); // 🔹 adição mínima para enviar via Expo (sem instalar libs)
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
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0, responses: [] };

  // 🔎 separa tokens Expo vs FCM pelo padrão do Expo
  const expoRe = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;
  const expoTokens = tokens.filter(t => expoRe.test(String(t || '')));
  const fcmTokens  = tokens.filter(t => !expoRe.test(String(t || '')));

  let totalSuccess = 0;
  let totalFail    = 0;
  const allResponses = [];

  // ========== A) Envio via FCM (Firebase Admin) para fcmTokens ==========
  if (fcmTokens.length) {
    ensureInit();
    const message = {
      tokens: fcmTokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])), // data precisa ser string
      android: { notification: { channelId: 'default', priority: 'high', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const res = await admin.messaging().sendEachForMulticast(message);

    // contabilidade
    totalSuccess += res.successCount || 0;
    totalFail    += res.failureCount || 0;
    if (Array.isArray(res.responses)) allResponses.push(...res.responses);

    // 🧹 limpa FCM tokens inválidos
    try {
      const invalidCodes = new Set([
        'messaging/invalid-argument',
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered'
      ]);
      await Promise.all(
        (res.responses || []).map(async (r, i) => {
          if (!r.success && r.error && invalidCodes.has(r.error.code)) {
            const bad = fcmTokens[i];
            if (bad) {
              await DeviceToken.deleteOne({ token: bad }).catch(() => {});
            }
          }
        })
      );
    } catch (_) {}
  }

  // ========== B) Envio via Expo para expoTokens ==========
  if (expoTokens.length) {
    const expoPayload = expoTokens.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      data,
    }));

    const postExpo = () =>
      new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'exp.host',
            path: '/--/api/v2/push/send',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          },
          (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
              try {
                const json = JSON.parse(raw || '{}');
                resolve(json);
              } catch (e) {
                resolve({ data: [] });
              }
            });
          }
        );
        req.on('error', reject);
        req.write(JSON.stringify(expoPayload));
        req.end();
      });

    try {
      const expoRes = await postExpo();
      const items = Array.isArray(expoRes?.data) ? expoRes.data : [];

      items.forEach((it, idx) => {
        const ok = it?.status === 'ok';
        totalSuccess += ok ? 1 : 0;
        totalFail    += ok ? 0 : 1;
        allResponses.push({
          success: ok,
          messageId: it?.id,
          error: ok ? null : { code: it?.details?.error || it?.message || 'expo_error' },
        });
      });

      // 🧹 limpa tokens "DeviceNotRegistered"
      await Promise.all(
        items.map(async (it, idx) => {
          const err = it?.details?.error || it?.message;
          if (it?.status === 'error' && String(err).toLowerCase().includes('devicenotregistered')) {
            const bad = expoTokens[idx];
            if (bad) await DeviceToken.deleteOne({ token: bad }).catch(() => {});
          }
        })
      );
    } catch (_) {
      // falha geral na chamada — não limpa tokens neste caso
    }
  }

  return { successCount: totalSuccess, failureCount: totalFail, responses: allResponses };
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
    const unread = await Notification.countDocuments({ user: userId, read: false });
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

// =============== ADIÇÃO: Agregação leve de chat (WhatsApp-light) ===============
// (duplicado no topo) const DeviceToken = require('../models/DeviceToken');

const DEFAULT_TZ = process.env.DEFAULT_TZ || 'America/Sao_Paulo';
const CHAT_WINDOW_MS_DEFAULT = 5 * 60 * 1000;   // 5 min
const CHAT_WINDOW_MS_EVENT_DAY = 2 * 60 * 1000; // 2 min (dia do evento)
const CONTENT_WINDOW_MS = 15 * 60 * 1000;       // 15 min (para futuras agregações de conteúdo)

const chatState = new Map(); // eventId -> { lastSentAt, timer, pendingCount, lastSnippet, lastSender }

/**
 * Retorna "YYYY-MM-DD" local no TZ informado (sem depender de libs externas).
 */
function ymdInTz(d, timeZone = DEFAULT_TZ) {
  if (!d) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(d));
}

/**
 * Decide janela de chat: se for "dia do evento" no TZ do usuário, usa 2min, senão 5min.
 * Considera dia do evento como [T-24h .. T+3h] para ser mais responsivo próximo ao evento.
 */
function getChatWindowMs(event, timeZone = DEFAULT_TZ) {
  const now = new Date();
  const start =
    event?.startAt || event?.start || event?.date || event?.datetime || event?.scheduledAt || null;

  if (!start) return CHAT_WINDOW_MS_DEFAULT;

  const ymdNow = ymdInTz(now, timeZone);
  const ymdEvent = ymdInTz(start, timeZone);

  if (!ymdNow || !ymdEvent) return CHAT_WINDOW_MS_DEFAULT;

  if (ymdNow === ymdEvent) {
    return CHAT_WINDOW_MS_EVENT_DAY; // mesmo dia local → 2 min
  }
  return CHAT_WINDOW_MS_DEFAULT;
}

/**
 * Envia push (já agregado) para recipients: 1º push imediato; subsequentes agregados até a janela expirar.
 */
async function queueChat({ event, recipients, senderName = 'Alguém', snippet = '', timeZone = DEFAULT_TZ }) {
  const eventId = String(event?._id || event?.id || '');
  if (!eventId || !Array.isArray(recipients) || recipients.length === 0) return;

  const state = chatState.get(eventId) || { lastSentAt: 0, timer: null, pendingCount: 0, lastSnippet: '', lastSender: '' };
  const now = Date.now();
  const windowMs = getChatWindowMs(event, timeZone);

  const title = `Chat — ${event?.title || event?.name || 'Evento'}`;

  // Função auxiliar para disparo
  const sendPush = async ({ body }) => {
    const tokens = (await DeviceToken.find({ user: { $in: recipients } }).select('token -_id')).map(t => t.token);
    if (!tokens.length) return;

    const data = {
      relatedModel: 'Event',
      relatedId: eventId,
      type: 'chat',
      threadId: `event:${eventId}:chat`, // iOS agrupa por threadId
      collapseKey: `event:${eventId}:chat`, // Android agrupa por collapseKey
    };

    await sendToTokens(tokens, { title, body, data });
  };

  // 1) Se nunca enviou (ou última janela já expirou) → envia IMEDIATO com preview
  if (!state.lastSentAt || now - state.lastSentAt > windowMs) {
    await sendPush({ body: `${senderName}: ${snippet}` });

    state.lastSentAt = now;
    state.pendingCount = 0;
    state.lastSnippet = '';
    state.lastSender = '';
    clearTimeout(state.timer);
    state.timer = null;
    chatState.set(eventId, state);
    return;
  }

  // 2) Dentro da janela: agrega
  state.pendingCount = (state.pendingCount || 0) + 1;
  state.lastSnippet = snippet || state.lastSnippet;
  state.lastSender = senderName || state.lastSender;

  // Agenda flush no restante da janela, se ainda não houver timer
  if (!state.timer) {
    const delay = Math.max(0, state.lastSentAt + windowMs - now);
    state.timer = setTimeout(async () => {
      try {
        const count = state.pendingCount || 0;
        if (count > 0) {
          const body = `+${count} novas mensagens • Última: ${state.lastSender}${state.lastSnippet ? ` — “${state.lastSnippet}”` : ''}`;
          await sendPush({ body });
        }
      } finally {
        state.lastSentAt = Date.now();
        state.pendingCount = 0;
        state.lastSnippet = '';
        state.lastSender = '';
        clearTimeout(state.timer);
        state.timer = null;
        chatState.set(eventId, state);
      }
    }, delay);
  }

  chatState.set(eventId, state);
}

module.exports.queueChat = queueChat;
// ===============================================================================


module.exports = { sendToTokens, sendUserPush, queueChat };
