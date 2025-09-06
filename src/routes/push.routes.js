const router = require('express').Router();
const pushController = require('../controllers/pushController');
const auth = require('../middlewares/auth');         // já existe no seu projeto
const allowRoles = require('../middlewares/roles');  // se tiver controle de papéis

// registrar token (app chama após obter FCM token)
router.post('/register', auth, pushController.registerToken);

// enviar teste (restringir a coordenadores/admins)
router.post('/test', auth, allowRoles(['coordenador', 'admin']), pushController.sendTest);

module.exports = router;
