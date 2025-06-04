const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

// 🧪 Log de verificação
console.log('🧪 [authController] Módulos carregados corretamente');

// ==============================================
// 🔐 AUTH BASICS
// ==============================================

const registerUser = asyncHandler(async (req, res) => {
  res.status(201).json({ message: 'Usuário registrado (mock)' });
});

const loginUser = asyncHandler(async (req, res) => {
  res.json({ token: 'fake-jwt-token' });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ message: 'Perfil retornado (mock)' });
});

// ==============================================
// 👤 PERFIL
// ==============================================

const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

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

// ==============================================
// 👥 USER MANAGEMENT
// ==============================================

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  res.json(user);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

  user.role = req.body.role;
  await user.save();

  res.json({ message: 'Função atualizada com sucesso', role: user.role });
});

const deleteCloudinaryImage = asyncHandler(async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) {
    return res.status(400).json({ message: 'Public ID é obrigatório.' });
  }

  await cloudinary.deleteImage(publicId);
  res.json({ message: 'Imagem removida com sucesso do Cloudinary.' });
});

// ==============================================
// ✅ EXPORTAÇÕES
// ==============================================

console.log('🧪 Exportando funções do controller:', {
  registerUser: typeof registerUser,
  loginUser: typeof loginUser,
  getMe: typeof getMe,
  updateMe: typeof updateMe,
  deleteAvatar: typeof deleteAvatar,
  getUserById: typeof getUserById,
  updateUserRole: typeof updateUserRole,
  deleteCloudinaryImage: typeof deleteCloudinaryImage
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar,
  getUserById,
  updateUserRole,
  deleteCloudinaryImage
};
