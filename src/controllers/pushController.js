//                                    const DeviceToken = require('../models/DeviceToken'); 
const { sendToTokens } = require('../services/pushService');
const pushService = require('../services/pushService'); // (exemplo já existente)

// ⬅️ ADIÇÃO CIRÚRGICA: import efetivo do model usado no envio/remoção
const DeviceToken = require('../models/DeviceToken');

const Event = require('../models/Event');

// POST /api/push/register  { token, platform }
exports.registerToken = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.body.userId; // fallback se já estiver autenticado via middleware
    if (!userId) return res.status(400).json({ message: 'userId ausente' });

    const { token, platform = 'android' } = req.body;
    if (!token) return res.status(400).json({ message: 'token ausente' });

    // 🔧 Registro idempotente por TOKEN (índice único costuma ser em "token")
    // - Se o token já existir, apenas atualiza user/plataforma/lastSeenAt
    // - Evita E11000 quando o mesmo token é reenviado (ou muda de usuário)
    await DeviceToken.updateOne(
      { token }, // filtro pela chave única
      {
        $set: {
          token,
          platform: String(platform || 'android').toLowerCase(),
          user: userId,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    // Tratar duplicidade como sucesso (idempotente)
    if (err?.code === 11000) {
      return res.json({ ok: true, duplicated: true });
    }
    next(err);
  }
};

// ⬅️ ADIÇÃO CIRÚRGICA: POST /api/push/unregister  { token }
exports.unregisterToken = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.body.userId;
    const { token } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId ausente' });
    if (!token)   return res.status(400).json({ message: 'token ausente' });

    const result = await DeviceToken.deleteOne({ user: userId, token });
    return res.json({ removed: result?.deletedCount || 0 });
  } catch (err) {
    next(err);
  }
};

// POST /api/push/chat  { eventId, senderId, senderName, snippet, tz? }
exports.enqueueChatMessage = async (req, res, next) => {
  try {
    const { eventId, senderId, senderName = 'Alguém', snippet = '', tz } = req.body || {};
    if (!eventId)  return res.status(400).json({ message: 'eventId ausente' });
    if (!senderId) return res.status(400).json({ message: 'senderId ausente' });

    // TZ preferencial: header > body > padrão
    const headerTz = req.get('X-TZ') || req.get('x-tz');
    const timeZone = (headerTz || tz || process.env.DEFAULT_TZ || 'America/Sao_Paulo');

    // Descobre destinatários a partir do evento (membros escalados)
    const event = await Event.findById(eventId)
      .populate({ path: 'scale', select: 'members', populate: { path: 'members.user', select: '_id' } })
      .lean();

    if (!event) return res.status(404).json({ message: 'Evento não encontrado' });

    // Extrai users da escala (modelo padronizado do seu backend)
    const scaleMembers = Array.isArray(event?.scale?.members) ? event.scale.members : [];
    const userIds = scaleMembers
      .map(m => (m?.user?._id || m?.user || null))
      .filter(Boolean)
      .filter(uid => String(uid) !== String(senderId));

    // Fallback leve (caso algum evento legado tenha outra estrutura)
    const altUsers = Array.isArray(event?.members) ? event.members.map(m => m?.user || m).filter(Boolean) : [];
    const recipients = userIds.length ? userIds : altUsers.filter(uid => String(uid) !== String(senderId));

    if (!recipients.length) {
      return res.json({ queued: false, recipients: 0 });
    }

    // Enfileira no serviço (agregação por janela + 1º push imediato)
    await pushService.queueChat({
      event,
      recipients,
      senderName,
      snippet,
      timeZone, // TZ do usuário/região
      senderId
    });

    return res.json({ queued: true, recipients: recipients.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/push/test  { userIds:[], title, body, data }
exports.sendTest = async (req, res, next) => {
  try {
    const { userIds = [], title = 'Teste', body = 'Notificação de teste', data = {} } = req.body;

    const query = userIds.length ? { user: { $in: userIds } } : {};
    const tokens = (await DeviceToken.find(query).select('token -_id')).map(t => t.token);

    // 🔧 Evita chamar provedor quando não há tokens
    if (!tokens.length) {
      return res.json({ sent: 0, result: { successCount: 0, failureCount: 0, responses: [] } });
    }

    const result = await sendToTokens(tokens, { title, body, data });
    res.json({ sent: tokens.length, result });
  } catch (err) {
    next(err);
  }
};
