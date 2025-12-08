// src/middleware/adminAuth.js
function adminAuth(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;
  const headerSecret = req.headers['x-admin-secret'];

  if (!adminSecret) {
    console.error('[adminAuth] ADMIN_SECRET não configurado nas variáveis de ambiente');
    return res.status(500).json({ message: 'Admin não configurado' });
  }

  if (!headerSecret || headerSecret !== adminSecret) {
    console.warn('[adminAuth] Tentativa de acesso admin com segredo inválido');
    return res.status(403).json({ message: 'Acesso não autorizado' });
  }

  next();
}

module.exports = adminAuth;
