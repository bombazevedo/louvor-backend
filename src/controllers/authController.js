const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs');

// Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoUrl: user.photoUrl,
        phone: user.phone,
        bio: user.bio,
        birthDate: user.birthDate,
        socials: user.socials
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno ao fazer login' });
  }
};

// Registro
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) return res.status(400).json({ message: 'Email já cadastrado' });

    const hashed = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashed, role: role || 'usuario' });
    await user.save();

    res.status(201).json({ message: 'Usuário registrado com sucesso' });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno ao registrar usuário' });
  }
};

// Buscar usuário por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
};

// Atualizar função do usuário (somente coordenador)
exports.updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem alterar funções.' });
    }

    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.status(200).json({ message: 'Função atualizada com sucesso.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar função do usuário' });
  }
};

// 🔥 Atualizar perfil do próprio usuário
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const allowedFields = ['photoUrl', 'cloudinaryPublicId', 'phone', 'birthDate', 'bio', 'socials'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('[updateMe] Erro ao atualizar perfil:', err);
    res.status(500).json({ message: 'Erro interno ao atualizar perfil' });
  }
};

// 📸 Upload e sobrescrita de avatar
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const filePath = req.file.path;

    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'avatars',
      public_id: `avatar_${userId}`,
      overwrite: true,
      resource_type: 'image',
    });

    fs.unlinkSync(filePath); // Limpa arquivo temporário

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        photoUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Avatar atualizado com sucesso!',
      user: updatedUser
    });
  } catch (error) {
    console.error('[uploadAvatar] Erro:', error);
    res.status(500).json({ message: 'Erro ao atualizar avatar' });
  }
};
