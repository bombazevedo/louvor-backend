// routes/deviceTokenRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // mantém seu padrão de models
const router = express.Router();

/**
 * Obtém o userId de forma resiliente:
 * 1) se já existir req.user (caso você tenha um middleware de auth), usa.
 * 2) senão, tenta decodificar o JWT do header Authorization (Bearer ...).
 * Se não achar, retorna null.
 */
function resolveUserId(req) {
  if (req.user && (req.user.id || req.user._id)) {
    return (req.user.id || req.user._id).toString();
  }

  const auth = (req.headers.authorization || '').trim();
  const token = (auth.split(' ')[1] || '').trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // compatível com backends que usam `id` ou `_id` no payload
    return (decoded.id || decoded._id || decoded.userId || '').toString() || null;
  } catch (_) {
    return null;
  }
}

/**
 * POST /api/notifications/push-token
 * (também aceitamos /api/push-token se você montar em /api/notifications)
 *
 * Body: { token: string }
 * Efeito: adiciona o token no array `deviceTokens` do usuário (sem duplicar).
 */
async function savePushTokenHandler(req, res) {
  try {
    const userId = resolveUserId(req);
    const raw = (req.body && req.body.token) || '';
    const token = typeof raw === 'string' ? raw.trim() : '';

    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }
    if (!token) {
      return res.status(400).json({ message: 'Token FCM/Expo inválido.' });
    }

    // Garante o campo deviceTokens como array e faz addToSet (não duplica)
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { deviceTokens: token } },
      { new: true }
    ).select('_id deviceTokens email name role');

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    return res.json({
      message: 'Token salvo com sucesso.',
      deviceTokens: user.deviceTokens || [],
    });
  } catch (err) {
    console.error('[deviceTokenRoutes] Erro ao salvar token:', err);
    return res.status(500).json({ message: 'Erro interno ao salvar token.' });
  }
}

/**
 * POST /api/notifications/remove-push-token
 * (também aceitamos /api/remove-push-token se você montar em /api/notifications)
 *
 * Body: { token: string }
 * Efeito: remove o token do array `deviceTokens` do usuário.
 */
async function removePushTokenHandler(req, res) {
  try {
    const userId = resolveUserId(req);
    const raw = (req.body && req.body.token) || '';
    const token = typeof raw === 'string' ? raw.trim() : '';

    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }
    if (!token) {
      return res.status(400).json({ message: 'Token FCM/Expo inválido.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { deviceTokens: token } },
      { new: true }
    ).select('_id deviceTokens email name role');

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    return res.json({
      message: 'Token removido com sucesso.',
      deviceTokens: user.deviceTokens || [],
    });
  } catch (err) {
    console.error('[deviceTokenRoutes] Erro ao remover token:', err);
    return res.status(500).json({ message: 'Erro interno ao remover token.' });
  }
}

/* ------------------------------------------------------------------ */
/* Rotas - mapeadas para funcionar com seu apiService sem mudanças.   */
/* Se você fizer app.use('/api', router), os paths finais serão:      */
/*   POST /api/notifications/push-token                               */
/*   POST /api/notifications/remove-push-token                        */
/* Também registramos os curtos (/push-token e /remove-push-token)    */
/* caso você opte por montar como app.use('/api/notifications', ...). */
/* ------------------------------------------------------------------ */

router.post('/notifications/push-token', savePushTokenHandler);
router.post('/notifications/remove-push-token', removePushTokenHandler);

// aliases (opcionais) para montagem alternativa em /api/notifications
router.post('/push-token', savePushTokenHandler);
router.post('/remove-push-token', removePushTokenHandler);

module.exports = router;
