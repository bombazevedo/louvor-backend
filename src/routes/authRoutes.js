const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');

// 🧪 Logando para validação
console.log('🧪 [authRoutes] Importações do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
});

console.log('🧪 [authRoutes] Middleware authenticate:', typeof authenticate);

// 🔐 Rotas públicas
router.post('/register', registerUser);
router.post('/login', loginUser);

// 🔒 Rotas privadas
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.delete('/me/avatar', authenticate, deleteAvatar);

module.exports = router;
