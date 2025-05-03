const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
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

    // Normaliza o papel do usuário para evitar problemas de capitalização
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

module.exports = authMiddleware;
