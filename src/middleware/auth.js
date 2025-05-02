const jwt = require('jsonwebtoken');

// Middleware de autenticação JWT
function authMiddleware(req, res, next) {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token ausente.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

module.exports = authMiddleware;
