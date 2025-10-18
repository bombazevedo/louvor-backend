const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getUserById,
  updateUserRole,
  updateMe,
  deleteCloudinaryImage,
  getBirthdays
} = require("../controllers/authController"); // 🔥 Mantido como está, seguindo sua organização atual
const User = require("../models/User");

// ✅ Retorna dados do usuário autenticado
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.status(200).json(user);
  } catch (err) {
    console.error('[GET /users/me] Erro:', err);
    res.status(500).json({ message: 'Erro ao buscar dados do usuário' });
  }
});

// ✅ Atualizar perfil próprio
router.patch("/me", authenticate, updateMe);

// ✅ Listar aniversariantes do mês
router.get("/birthdays", authenticate, getBirthdays);

// ✅ Listar todos os usuários
router.get("/", authenticate, async (req, res) => {
  try {
    const users = req.user.role === 'coordenador'
      ? await User.find().select('-password')
      : await User.find().select('name _id');

    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error.message);
    res.status(500).json({ message: 'Erro ao buscar usuários.' });
  }
});

// ✅ Buscar por ID
router.get("/:id", authenticate, getUserById);

// ✅ Atualizar função do usuário (somente coordenador)
router.patch("/:id", authenticate, updateUserRole);

// ✅ Atualização completa de perfil por ID (restrita a admin ou dono)
router.put("/:id", authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== "coordenador") {
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

// ✅ Deletar usuário
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== "coordenador") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

// 🔒 Proteção: NÃO permitir excluir o fundador da organização (ou fundador global como fallback)
try {
  // Detecta dinamicamente uma chave de organização já existente no seu modelo (hoje ou no futuro)
  const orgKey = ['organizationId', 'organization', 'orgId', 'groupId', 'communityId', 'teamId']
    .find(k => user?.[k] !== undefined && user?.[k] !== null);

  // Se houver orgKey, busca o fundador da MESMA organização; senão, busca o fundador global
  const founderQuery = orgKey ? { [orgKey]: user[orgKey] } : {};
  const founder = await User.findOne(founderQuery)
    .sort({ createdAt: 1, _id: 1 }) // createdAt prioritário; _id como fallback determinístico
    .select('_id createdAt');

  if (founder && String(founder._id) === String(user._id)) {
    return res.status(403).json({ message: 'Não é possível excluir o coordenador fundador desta organização.' });
  }
} catch (e) {
  // Se algo der errado na checagem do fundador, não bloqueia outras exclusões por acidente.
  console.warn('[users:delete] Falha ao checar fundador:', e?.message);
}

    await User.findByIdAndRemove(req.params.id);
    res.json({ message: "Usuário removido" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// ☁️ Deletar imagem antiga (Cloudinary)
router.post("/auth/delete-cloudinary", authenticate, deleteCloudinaryImage);

module.exports = router;
