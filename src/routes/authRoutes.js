const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// Rota para registro de usuário
router.post('/register', authController.register);

// Rota para login de usuário
router.post('/login', authController.login);

// Rota para obter usuário atual
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;
