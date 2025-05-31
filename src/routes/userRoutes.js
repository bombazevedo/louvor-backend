const express = require("express");
const router = express.Router();

const {
  getUserById,
  updateUser,
  updateUserRole
} = require("../controllers/authController"); // 🔧 Corrigido: usamos authController

const { authenticate } = require("../middlewares/auth"); // ✅ Caminho correto do middleware

// 📌 GET usuário por ID
router.get("/:id", authenticate, getUserById);

// 📌 PATCH atualizar perfil (inclui avatar)
router.patch("/:id", authenticate, updateUser);

// 📌 PATCH atualizar papel do usuário
router.patch("/role/:id", authenticate, updateUserRole);

module.exports = router;
