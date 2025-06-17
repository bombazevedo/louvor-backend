const jwt = require("jsonwebtoken");

// 🔐 Autenticador global
exports.authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token ausente." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.id; // 🔥 🔥 🔥 Alinhado com o Canvas → Obrigatório
    next();
  } catch (error) {
    res.status(401).json({ message: "Token inválido." });
  }
};

// ✅ Verifica se o usuário é coordenador
exports.isCoordinator = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (role === "coordenador") return next();
  return res.status(403).json({ message: "Acesso restrito a coordenadores." });
};

// ✅ Verifica se é coordenador ou DM
exports.isDMOrCoordinator = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (role === "coordenador" || role === "dm") {
    return next();
  }
  return res.status(403).json({ message: "Acesso restrito a coordenadores ou DMs." });
};
