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

// 🧠 Uso RESTful
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.delete('/me/avatar', protect, deleteAvatar); // rota corrigida

module.exports = router;
