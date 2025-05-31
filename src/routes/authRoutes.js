const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getCurrentUser
} = require("../controllers/authController");

const { authenticate } = require("../middlewares/auth");

// 🆕 Criar nova conta
router.post("/register", register);

// 🔐 Login do usuário
router.post("/login", login);

// 📌 Usuário logado
router.get("/me", authenticate, getCurrentUser);

module.exports = router;
