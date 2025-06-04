const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
} = require('../controllers/authController'); // ✅ Confirme que todas estão exportadas

const { protect } = require('../middleware/auth'); // ✅ Confirme se o caminho é correto

// 🔐 Auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.delete('/me/avatar', protect, deleteAvatar); // ✅ REST correto

module.exports = router;
