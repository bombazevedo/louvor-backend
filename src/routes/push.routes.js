// routes/push.routes.js
const router = require('express').Router();
const pushController = require('../controllers/pushController');

// ⚠️ Alinhar o caminho com o usado nas demais rotas
const auth = require('../middleware/auth');

// registrar token (app chama após obter FCM token)
router.post('/register', auth.authenticate, pushController.registerToken);

// chat → enfileira/agrega push de chat por evento (WhatsApp-light)
router.post('/chat', auth.authenticate, pushController.enqueueChatMessage);

// descadastrar token deste dispositivo (desligar PUSH para este aparelho)
router.post('/unregister', auth.authenticate, pushController.unregisterToken);

// enviar teste (restringir a coordenadores/DMs)
router.post('/test', auth.authenticate, auth.isDMOrCoordinator, pushController.sendTest);

module.exports = router;
