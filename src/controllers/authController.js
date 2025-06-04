const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary'); // já contém deleteImage()

// @desc    Registrar novo usuário
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  // ... (sem alteração)
});

// @desc    Login
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  // ... (sem alteração)
});

// @desc    Obter perfil
// @route   GET /api/users/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  // ... (sem alteração)
});

// @desc    Atualizar perfil do usuário
// @route   PATCH /api/users/me
// @access  Private
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

// @desc    Excluir avatar atual do usuário
// @route   DELETE /api/users/avatar
// @access  Private
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

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteAvatar, // ✅ novo export
};
