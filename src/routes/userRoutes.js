const express = require("express");
const router = express.Router();
const {
  getUserById,
  updateUserRole,
  updateUser, // ✅ Adicionado aqui
} = require("../controllers/authController");

const {
  getAllUsers,
  deleteUser,
  searchUsers,
} = require("../controllers/userController");

const { authenticate } = require("../middlewares/authMiddleware");

// 🔒 Authenticated routes
router.get("/", authenticate, getAllUsers);
router.get("/search", authenticate, searchUsers);
router.get("/:id", authenticate, getUserById);

// ✅ Correção aqui: Rota para update de perfil do usuário
router.put("/:id", authenticate, updateUser);

// Patch separado para alterar apenas a role
router.patch("/:id/role", authenticate, updateUserRole);

router.delete("/:id", authenticate, deleteUser);

module.exports = router;
