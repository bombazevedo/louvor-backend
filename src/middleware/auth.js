const jwt = require('jsonwebtoken');

// Middleware de autenticação JWT
function authMiddleware(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Acesso negado. Token ausente.' });
  }

  // Remove prefixo "Bearer " se presente
  const token = authHeader.replace(/^Bearer\s+/i, '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user || decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

module.exports = authMiddleware;
