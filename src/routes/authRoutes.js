// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// Wrapper simples para capturar erros async e mandar pro handler global
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Diagnóstico rápido da rota (opcional, útil no staging)
router.get('/_ping', (_req, res) => res.json({ pong: true }));

// Auth
router.post('/login',    asyncHandler(loginUser));
router.post('/register', asyncHandler(registerUser));

// 🔐 Recuperação de senha
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password',  asyncHandler(resetPassword));

module.exports = router;
