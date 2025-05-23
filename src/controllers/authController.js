const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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
    user = new User({ name, email, password: hashed, role: role || 'Membro' });
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
