const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { getUserById, updateUserRole } = require("../controllers/authController");
const User = require("../models/User");

// Listar todos os usuários (somente coordenador/admin)
router.get("/", authenticate, async (req, res) => {
  try {
    const allowedRoles = ["coordenador", "admin"];
    if (!allowedRoles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ message: "Acesso negado. Permissão insuficiente." });
    }

    const users = await User.find().select("name email role");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// Buscar usuário por ID
router.get("/:id", authenticate, getUserById);

// Atualizar apenas a função do usuário (PATCH)
router.patch("/:id", authenticate, updateUserRole);

// Atualização completa de perfil (PUT)
router.put("/:id", authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const { name, email, phone, instruments, roles } = req.body;
    const userFields = {};
    if (name) userFields.name = name;
    if (email) userFields.email = email;
    if (phone) userFields.phone = phone;
    if (instruments) userFields.instruments = instruments;
    if (roles) userFields.roles = roles;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: userFields },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// Deletar usuário
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    await User.findByIdAndRemove(req.params.id);
    res.json({ message: "Usuário removido" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

module.exports = router;
