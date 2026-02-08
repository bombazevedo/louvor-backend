// routes/notifications.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');

// ⚠️ Middleware de autenticação
// (seu arquivo está em src/middleware/auth, sem "s")
const auth = require('../middleware/auth');

// Usa especificamente a função de autenticação
router.use(auth.authenticate);

router.get('/', ctrl.listMine);                  // GET    /api/notifications
router.get('/unread-count', ctrl.unreadCount);   // GET    /api/notifications/unread-count  ← (ADICIONADO)
router.post('/', ctrl.create);                   // POST   /api/notifications
router.patch('/read-all', ctrl.markAllRead);     // PATCH  /api/notifications/read-all
router.patch('/:id/read', ctrl.markOneRead);     // PATCH  /api/notifications/:id/read
router.delete('/:id', ctrl.removeOne);           // DELETE /api/notifications/:id

module.exports = router;
