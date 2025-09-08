const DeviceToken = require('../models/DeviceToken');
const { sendToTokens } = require('../services/pushService');

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
