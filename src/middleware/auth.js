const jwt = require("jsonwebtoken");
const OrgMember = require("../models/OrgMember");          // ✅ adição cirúrgica
const User = require("../models/User");                   // ✅ (NOVO) valida sessão (1 device)
const Organization = require("../models/Organization");    // ✅ adição cirúrgica

// 🔐 Autenticador global
exports.authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token ausente." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ (NOVO) trava 1 dispositivo por login
    // se token antigo (sem sid), força relogar para entrar na regra
    if (!decoded?.sid) {
      return res.status(401).json({ message: "Sessão expirada. Faça login novamente." });
    }

    const user = await User.findById(decoded.id).select("+sessionNonce").lean();
    if (!user) return res.status(401).json({ message: "Token inválido." });

    // se o sid do token for diferente do último salvo, este token foi “derrubado”
    if (!user.sessionNonce || String(user.sessionNonce) !== String(decoded.sid)) {
      return res.status(401).json({ message: "Sessão encerrada por novo login." });
    }

    req.user = decoded;
    req.userId = decoded.id; // 🔥 🔥 🔥 Alinhado com o Canvas → Obrigatório
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
};

// ✅ Verifica se o usuário é coordenador
exports.isCoordinator = async (req, res, next) => {
  try {
    // normaliza ID
    const userId =
      (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    // se há contexto de organização, valida por membership/owner da org ativa
    if (req.orgId) {
      const org = req._org || (await Organization.findById(req.orgId).lean());
      if (!org) return res.status(404).json({ message: "Organização não encontrada." });

      const isOwner = String(org.owner) === String(userId);
      if (isOwner) return next();

      const membership = await OrgMember.findOne({ org: req.orgId, user: userId }).lean();
      if (membership && membership.role === "coordenador") return next();

      return res.status(403).json({ message: "Acesso restrito a coordenadores." });
    }

    // fallback (sem org): usa role do token
    const role = req.user?.role?.toLowerCase();
    if (role === "coordenador") return next();
    return res.status(403).json({ message: "Acesso restrito a coordenadores." });
  } catch (err) {
    console.error("[isCoordinator] erro:", err);
    return res.status(500).json({ message: "Erro de autorização." });
  }
};

// ✅ Verifica se é coordenador ou DM
exports.isDMOrCoordinator = async (req, res, next) => {
  try {
    // normaliza ID
    const userId =
      (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    if (req.orgId) {
      const org = req._org || (await Organization.findById(req.orgId).lean());
      if (!org) return res.status(404).json({ message: "Organização não encontrada." });

      const isOwner = String(org.owner) === String(userId);
      if (isOwner) return next();

      const membership = await OrgMember.findOne({ org: req.orgId, user: userId }).lean();
      if (membership && (membership.role === "coordenador" || membership.role === "dm")) {
        return next();
      }
      return res.status(403).json({ message: "Acesso restrito a coordenadores ou DMs." });
    }

    // fallback (sem org): usa role do token
    const role = req.user?.role?.toLowerCase();
    if (role === "coordenador" || role === "dm") {
      return next();
    }
    return res.status(403).json({ message: "Acesso restrito a coordenadores ou DMs." });
  } catch (err) {
    console.error("[isDMOrCoordinator] erro:", err);
    return res.status(500).json({ message: "Erro de autorização." });
  }
};
