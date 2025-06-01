const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const os = require("os");

const {
  getUserById,
  updateUserRole,
  updateMe,
  uploadAvatar
} = require("../controllers/authController");

const { authenticate } = require("../middleware/auth");
const User = require("../models/User");

// ⚙️ Multer config: upload temporário
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[\/\\]/g, "_");
    cb(null, Date.now() + "-" + safeName);
  },
});

const upload = multer({ storage });

// 📄 Listar todos os usuários (acesso controlado por papel)
router.get("/", authenticate, async (req, res) => {
  try {
    let users;

    if (req.user.role === 'coordenador') {
      users = await User.find().select('-password');
    } else {
      users = await User.find().select('name _id');
    }

    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error.message);
    res.status(500).json({ message: 'Erro ao buscar usuários.' });
  }
});

// 🔍 Buscar usuário por ID
router.get("/:id", authenticate, getUserById);

// 🛡️ Atualizar função (somente coordenador)
router.patch("/:id", authenticate, updateUserRole);

// 📝 Atualização completa de perfil
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

// ❌ Deletar usuário
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

// 🙋 Atualizar o próprio perfil (bio, tel, etc)
router.patch("/me", authenticate, updateMe);

// 📸 Upload de avatar (Cloudinary - sobrescreve)
router.post("/upload-avatar", authenticate, upload.single("avatar"), uploadAvatar);

module.exports = router;
