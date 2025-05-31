const express = require("express");
const router = express.Router();
const {
  getUserById,
  updateUserRole,
  updateUser, // ✅ Confirmado: usado no PUT
} = require("../controllers/authController");

const { authenticate } = require("../middlewares/auth");

// 🛡️ Autenticação obrigatória
router.get("/:id", authenticate, getUserById);
router.put("/:id", authenticate, updateUser); // ✅ Atualiza perfil
router.patch("/:id/role", authenticate, updateUserRole); // ✅ Atualiza role

// ❌ Removidas rotas de controller inexistente:
// router.get("/", authenticate, getAllUsers);
// router.get("/search", authenticate, searchUsers);
// router.delete("/:id", authenticate, deleteUser);

module.exports = router;
