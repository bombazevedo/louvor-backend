// routes/notifications.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');

// ⚠️ Use o seu middleware de autenticação já existente
// Ele precisa popular req.user.id (ou req.user._id) com o id do usuário do token
const auth = require('../middleware/auth'); // ajuste o caminho se necessário

router.use(auth);

router.get('/', ctrl.listMine);                  // GET    /api/notifications
router.post('/', ctrl.create);                   // POST   /api/notifications
router.patch('/read-all', ctrl.markAllRead);     // PATCH  /api/notifications/read-all
router.patch('/:id/read', ctrl.markOneRead);     // PATCH  /api/notifications/:id/read
router.delete('/:id', ctrl.removeOne);           // DELETE /api/notifications/:id

module.exports = router;
