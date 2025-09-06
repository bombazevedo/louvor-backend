const DeviceToken = require('../models/DeviceToken');
const { sendToTokens } = require('../services/pushService');

// POST /api/push/register  { token, platform }
exports.registerToken = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.body.userId; // fallback se já estiver autenticado via middleware
    if (!userId) return res.status(400).json({ message: 'userId ausente' });
    const { token, platform = 'android' } = req.body;
    if (!token) return res.status(400).json({ message: 'token ausente' });

    await DeviceToken.findOneAndUpdate(
      { user: userId, token },
      { user: userId, token, platform, lastSeenAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
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

    const result = await sendToTokens(tokens, { title, body, data });
    res.json({ sent: tokens.length, result });
  } catch (err) {
    next(err);
  }
};
