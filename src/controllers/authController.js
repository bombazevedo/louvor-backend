const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

// 🧪 Log de carga
console.log('🧪 [authController] Módulos carregados corretamente');

// 🔑 Gera token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// ✅ Registrar novo usuário
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Todos os campos são obrigatórios');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Usuário já existe');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  if (user) {
    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user.id),
    });
  } else {
    res.status(500);
    throw new Error('Falha ao criar usuário');
  }
});

// ✅ Login do usuário
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
    });
  } else {
    res.status(401);
    throw new Error('Credenciais inválidas');
  }
});

// ✅ Retorna dados do perfil logado
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
  res.status(200).json(user);
});

// ✅ Atualiza perfil do usuário autenticado
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (req.body.name) user.name = req.body.name;
  if (req.body.email) user.email = req.body.email;
  if (req.body.photoUrl) user.photoUrl = req.body.photoUrl;
  if (req.body.cloudinaryPublicId) user.cloudinaryPublicId = req.body.cloudinaryPublicId;

  await user.save();

  res.json({
    _id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
    cloudinaryPublicId: user.cloudinaryPublicId,
  });
});

// ✅ Deleta avatar atual do Cloudinary e limpa no banco
const deleteAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user.cloudinaryPublicId) {
    return res.status(400).json({ message: 'Nenhum avatar atual para excluir.' });
  }

  await cloudinary.deleteImage(user.cloudinaryPublicId);
  user.photoUrl = '';
  user.cloudinaryPublicId = '';
  await user.save();

  res.json({ message: 'Avatar removido com sucesso.' });
});

// 🧪 Log de exportação
console.log('🧪 Exportando funções do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
};
