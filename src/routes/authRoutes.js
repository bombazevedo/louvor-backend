const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth'); // ✅ Corrigido

console.log('🧪 [authRoutes] Importações do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
});
console.log('🧪 [authRoutes] Middleware authenticate:', typeof authenticate);

// ⚠️ Trocar '/' por '/register' é opcional REST compliance
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.delete('/me/avatar', authenticate, deleteAvatar); // ✅ Correção aqui também

module.exports = router;
