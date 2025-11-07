const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔐 Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body || {};
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET não configurado' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role.toLowerCase()
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[loginUser] Erro interno:', err.message);
    res.status(500).json({ message: 'Erro interno ao fazer login' });
  }
};

// 📋 Registro
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body || {};
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) return res.status(400).json({ message: 'Email já cadastrado' });

    const hashed = await bcrypt.hash(password, 10);
    user = new User({
      name,
      email,
      password: hashed,
      role: (role || 'usuario').toLowerCase()
    });

    await user.save();

    res.status(201).json({ message: 'Usuário registrado com sucesso' });
  } catch (err) {
    console.error('[registerUser] Erro interno:', err.message);
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).json({ message: 'Email já cadastrado' });
    }
    res.status(500).json({ message: 'Erro interno ao registrar usuário' });
  }
};

// 🔎 Buscar por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.status(200).json(user);
  } catch (err) {
    console.error('[getUserById] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
};

// 🎚 Atualizar função (somente coordenador)
exports.updateUserRole = async (req, res) => {
  try {
    if (req.user.role?.toLowerCase() !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem alterar funções.' });
    }

    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role: role.toLowerCase() },
      { new: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.status(200).json({ message: 'Função atualizada com sucesso.', user: updatedUser });
  } catch (err) {
    console.error('[updateUserRole] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao atualizar função do usuário' });
  }
};

// 🛠 Atualizar perfil do próprio usuário
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const allowedFields = [
      'photoUrl',
      'cloudinaryPublicId',
      'phone',
      'birthDate',
      'bio',
      'socials'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.cloudinaryPublicId && updates.cloudinaryPublicId !== user.cloudinaryPublicId) {
      if (user.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(user.cloudinaryPublicId);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('[updateMe] Erro ao atualizar perfil:', err.message);
    res.status(500).json({ message: 'Erro interno ao atualizar perfil' });
  }
};

// ☠️ Deleta imagem no Cloudinary diretamente via public_id
exports.deleteCloudinaryImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ message: 'public_id obrigatório' });

    const result = await cloudinary.uploader.destroy(public_id);
    res.status(200).json({ message: 'Imagem deletada com sucesso', result });
  } catch (err) {
    console.error('[deleteCloudinaryImage] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao deletar imagem' });
  }
};

// 🎂 Listar aniversariantes do mês atual
exports.getBirthdays = async (req, res) => {
  try {
    const month = new Date().getMonth();
    const users = await User.find(
      { birthDate: { $exists: true } },
      { name: 1, birthDate: 1, photoUrl: 1 }
    );

    const birthdays = users.filter(u => {
      const d = new Date(u.birthDate);
      return d.getMonth() === month;
    });

    res.status(200).json(birthdays);
  } catch (err) {
    console.error('[getBirthdays] Erro ao buscar aniversariantes:', err.message);
    res.status(500).json({ message: 'Erro ao buscar aniversariantes' });
  }
};
