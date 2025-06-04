const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar, // ✅ novo
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.delete('/avatar', protect, deleteAvatar); // ✅ nova rota segura

module.exports = router;
