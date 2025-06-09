const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token ausente." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token inválido." });
  }
};

exports.isCoordinator = (req, res, next) => {
  if (req.user.role === "coordinator") return next();
  return res.status(403).json({ message: "Acesso restrito a coordenadores." });
};

exports.isDMOrCoordinator = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'coordinator' || role === 'dm') {
    return next();
  }
  return res.status(403).json({ message: "Acesso restrito a coordenadores ou DMs." });
};
