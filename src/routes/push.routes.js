// routes/push.routes.js
const router = require('express').Router();
const pushController = require('../controllers/pushController');

// ⚠️ Alinhar o caminho com o usado nas demais rotas
const auth = require('../middleware/auth');

// registrar token (app chama após obter FCM token)
router.post('/register', auth.authenticate, pushController.registerToken);

// enviar teste (restringir a coordenadores/DMs)
router.post('/test', auth.authenticate, auth.isDMOrCoordinator, pushController.sendTest);

module.exports = router;
