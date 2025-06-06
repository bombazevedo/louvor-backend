// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

console.log('🧪 [authController] Módulos carregados corretamente');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// 📌 Login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Senha incorreta' });
  }

  const token = generateToken(user._id, user.role);

  res.status(200).json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
    },
  });
});

// ✅ Corrigido: Retornar perfil real do usuário autenticado
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

  res.status(200).json(user);
});

// ⚙️ Demais funções (inalteradas para preservar lógica anterior)
const registerUser = asyncHandler(async (req, res) => {
  res.status(201).json({ message: 'Usuário registrado (mock)' });
});

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

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado' });
  }
  res.json(user);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

  user.role = role;
  await user.save();

  res.json({ message: 'Função atualizada', role: user.role });
});

const deleteCloudinaryImage = asyncHandler(async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) {
    return res.status(400).json({ message: 'publicId é obrigatório' });
  }

  await cloudinary.deleteImage(publicId);
  res.json({ message: 'Imagem deletada com sucesso' });
});

console.log('🧪 Exportando funções do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
  getUserById: typeof getUserById,
  updateUserRole: typeof updateUserRole,
  deleteCloudinaryImage: typeof deleteCloudinaryImage,
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
  getUserById,
  updateUserRole,
  deleteCloudinaryImage,
};
