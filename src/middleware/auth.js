const jwt = require('jsonwebtoken');
const config = require('../config');

// Middleware para verificar token de autenticação
const auth = (req, res, next) => {
  // Obter token do cabeçalho
  const token = req.header('x-auth-token');
  
  // Verificar se o token existe
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }
  
  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Adicionar usuário ao objeto de requisição
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido.' });
  }
};

// Middleware para verificar permissões de admin
const admin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
  }
  next();
};

// Middleware para verificar permissões de líder ou admin
const leader = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'líder') {
    return res.status(403).json({ message: 'Acesso negado. Permissão de líder necessária.' });
  }
  next();
};

module.exports = { auth, admin, leader };
