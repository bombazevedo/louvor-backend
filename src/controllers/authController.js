const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// JWT Generator
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// 📌 REGISTER
exports.registerUser = async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Usuário já existe.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword, phone });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({ user: { ...user._doc, password: undefined }, token });
  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ message: 'Erro ao registrar usuário.' });
  }
};

// 🔐 LOGIN
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const token = generateToken(user);
    res.json({ user: { ...user._doc, password: undefined }, token });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ message: 'Erro ao fazer login.' });
  }
};

// 👤 GET PROFILE
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err.message);
    res.status(500).json({ error: 'Erro interno ao buscar usuário' });
  }
};

// ✏️ UPDATE PROFILE
exports.updateUser = async (req, res) => {
  try {
    const { name, phone, birthDate, bio, socials, avatarUrl } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (birthDate) updates.birthDate = birthDate;
    if (bio) updates.bio = bio;
    if (socials) updates.socials = socials;
    if (avatarUrl) {
      const user = await User.findById(req.params.id);
      if (user.avatarUrl && user.avatarUrl !== avatarUrl) {
        // 🔥 Deletar imagem anterior no Cloudinary
        const publicId = extractPublicIdFromUrl(user.avatarUrl);
        if (publicId) {
          await axios.post(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/delete_by_token`, {
            token: process.env.CLOUDINARY_API_SECRET,
            public_id: publicId
          });
        }
      }
      updates.avatarUrl = avatarUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(updatedUser);
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err.message);
    res.status(500).json({ message: 'Erro ao atualizar perfil' });
  }
};

// 🧑‍🏫 UPDATE ROLE
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.json(user);
  } catch (err) {
    console.error('Erro ao atualizar função do usuário:', err.message);
    res.status(500).json({ message: 'Erro ao atualizar função.' });
  }
};

// 🔍 Extração do public_id do Cloudinary (sem extensão)
const extractPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/');
    const filename = parts.pop().split('.')[0];
    return filename;
  } catch {
    return null;
  }
};
