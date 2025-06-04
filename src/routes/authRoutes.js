const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// 🧪 Confirma se as funções foram importadas corretamente
console.log('🧪 [authRoutes] Importações do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
});
console.log('🧪 [authRoutes] Middleware protect:', typeof protect);

// 🚦 Rotas RESTful
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.delete('/me/avatar', protect, deleteAvatar);

module.exports = router;
