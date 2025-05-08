const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware principal: autenticação via JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token não fornecido." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("id name email role");
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    user.role = user.role.toLowerCase();

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    console.error("Erro na autenticação:", err);
    return res.status(401).json({ message: "Token inválido." });
  }
};

// Middleware adicional: apenas coordenadores
const isCoordinator = (req, res, next) => {
  if (req.user?.role === "coordenador") {
    return next();
  }
  return res.status(403).json({ message: "Acesso restrito a coordenadores." });
};

// Exportação padronizada
exports.authenticate = authenticate;
exports.isCoordinator = isCoordinator;
