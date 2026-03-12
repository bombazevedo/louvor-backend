const User = require('../models/User');
const OrgMember = require('../models/OrgMember'); // ✅ (ADIÇÃO) trava DM por organização
const { getEntitlementsFor } = require('../utils/entitlements'); // ✅ (ADIÇÃO) matriz de planos

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔐 Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body || {};
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET não configurado' });
    }

    // ✅ (NOVO) trava 1 dispositivo por login:
    // gera um nonce novo; ao salvar no usuário, invalida tokens anteriores automaticamente
    const sessionNonce = crypto.randomBytes(24).toString('hex');
    user.sessionNonce = sessionNonce;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role.toLowerCase(),
        sid: sessionNonce
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[loginUser] Erro interno:', err.message);
    res.status(500).json({ message: 'Erro interno ao fazer login' });
  }
};

// 📋 Registro
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body || {};
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) return res.status(400).json({ message: 'Email já cadastrado' });

    const hashed = await bcrypt.hash(password, 10);
    user = new User({
      name,
      email,
      password: hashed,
      role: (role || 'usuario').toLowerCase()
    });

    await user.save();

    res.status(201).json({ message: 'Usuário registrado com sucesso' });
  } catch (err) {
    console.error('[registerUser] Erro interno:', err.message);
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).json({ message: 'Email já cadastrado' });
    }
    res.status(500).json({ message: 'Erro interno ao registrar usuário' });
  }
};

// 🔎 Buscar por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.status(200).json(user);
  } catch (err) {
    console.error('[getUserById] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
};

// 🎚 Atualizar função (somente coordenador) — com trava de DM por ORGANIZAÇÃO
exports.updateUserRole = async (req, res) => {
  try {
    // ✅ Fonte de verdade: papel na organização (orgContext injeta req.orgRole/req.orgId/req._org)
    if ((req.orgRole || req.user.role)?.toLowerCase() !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem alterar funções.' });
    }

    const { role } = req.body || {};
    const nextRole = String(role || '').toLowerCase().trim();

    if (!nextRole) {
      return res.status(400).json({ message: 'Role inválida.' });
    }

    const targetUserId = req.params.id;

    // ✅ Trava por organização (quando promovendo para DM)
    
    if (nextRole === 'dm') {
      const orgId = req.orgId;
      if (!orgId) {
        return res.status(400).json({ message: 'Organização ativa não identificada.' });
      }

      // Entitlements do plano atual da org
      const ent = getEntitlementsFor(req._org || req.org || null);
      const dmLimit = ent?.limits?.dmsPerOrg ?? null; // null => ilimitado

      if (dmLimit !== null) {
        // Verifica membership do alvo e se já é DM (evita bloquear “setar DM” de quem já é DM)
        const existingMember = await OrgMember.findOne({ org: orgId, user: targetUserId })
          .select('_id role')
          .lean();

        const alreadyDm = String(existingMember?.role || '').toLowerCase() === 'dm';

        if (!alreadyDm) {
          const currentDmCount = await OrgMember.countDocuments({ org: orgId, role: 'dm' });

          if (currentDmCount >= dmLimit) {
            return res.status(403).json({
              message: 'Limite de Diretores Musicais atingido para este plano. Faça upgrade para adicionar mais DMs.',
              code: 'DM_LIMIT_REACHED',
              limit: dmLimit,
              current: currentDmCount,
            });
          }
        }
      }
    }

    // ✅ Atualiza papel no vínculo OrgMember (se existir)
    // (mínima intervenção: não quebra estruturas antigas e atende multi-org)
    if (req.orgId) {
      await OrgMember.findOneAndUpdate(
        { org: req.orgId, user: targetUserId },
        { role: nextRole },
        { new: true }
      );
    }

    // ✅ Compatibilidade: mantém atualização do User.role (seu fluxo atual pode depender disso)
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { role: nextRole },
      { new: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });

    return res.status(200).json({ message: 'Função atualizada com sucesso.', user: updatedUser });
  } catch (err) {
    console.error('[updateUserRole] Erro:', err?.message || err);
    return res.status(500).json({ message: 'Erro ao atualizar função do usuário' });
  }
};

// 🛠 Atualizar perfil do próprio usuário
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const allowedFields = [
      'photoUrl',
      'cloudinaryPublicId',
      'phone',
      'birthDate',
      'bio',
      'socials'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.cloudinaryPublicId && updates.cloudinaryPublicId !== user.cloudinaryPublicId) {
      if (user.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(user.cloudinaryPublicId);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('[updateMe] Erro ao atualizar perfil:', err.message);
    res.status(500).json({ message: 'Erro interno ao atualizar perfil' });
  }
};

// ☠️ Deleta imagem no Cloudinary diretamente via public_id
exports.deleteCloudinaryImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ message: 'public_id obrigatório' });

    const result = await cloudinary.uploader.destroy(public_id);
    res.status(200).json({ message: 'Imagem deletada com sucesso', result });
  } catch (err) {
    console.error('[deleteCloudinaryImage] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao deletar imagem' });
  }
};

// 🎂 Listar aniversariantes do mês atual
exports.getBirthdays = async (req, res) => {
  try {
    const month = new Date().getMonth(); // (LEGADO) mês pelo relógio do servidor (provável UTC)

    // ✅ Usa o fuso do app/usuário para definir "mês atual"
    const tz = String(req.headers['x-tz'] || req.headers['x-timezone'] || 'America/Sao_Paulo');
    const now = new Date();

    const monthInTz = (() => {
      try {
        const m = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now);
        const n = parseInt(m, 10);
        return Number.isNaN(n) ? month : (n - 1); // 0-11
      } catch (e) {
        return month; // fallback seguro
      }
    })();

    // ✅ Multi-igrejas: aniversariantes SOMENTE da organização ativa
    if (!req.orgId) {
      return res.status(400).json({ message: 'Org não informada (x-org-id)' });
    }

    const memberships = await OrgMember.find({ org: req.orgId }).select('user').lean();
    const userIds = memberships.map(m => m.user).filter(Boolean);

    if (!userIds.length) {
      return res.status(200).json([]);
    }

    // ✅ Garante que NÃO entra null/undefined (resolve "todo mundo em janeiro")
    const users = await User.find(
      { _id: { $in: userIds }, birthDate: { $type: 'date' } },
      { name: 1, birthDate: 1, photoUrl: 1 }
    );

    const monthFmt = (() => {
      try {
        return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' });
      } catch (e) {
        return null;
      }
    })();

    const birthdays = users.filter(u => {
      const d = new Date(u.birthDate);
      if (Number.isNaN(d.getTime())) return false;

      if (!monthFmt) {
        // fallback: mês do Date() puro
        return d.getMonth() === monthInTz;
      }

      const m = parseInt(monthFmt.format(d), 10);
      if (Number.isNaN(m)) return false;
      return (m - 1) === monthInTz;
    });

    return res.status(200).json(birthdays);
  } catch (err) {
    console.error('[getBirthdays] Erro ao buscar aniversariantes:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar aniversariantes' });
  }
};

// 🔑 Solicitar recuperação de senha (OTP 6 dígitos via e-mail)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    const safeMsg = { message: 'Se existir uma conta com este e-mail, enviaremos um código de recuperação.' };

    if (!email || typeof email !== 'string') {
      return res.status(200).json(safeMsg);
    }

        const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+resetCodeLastSentAt');


    // Sempre responde 200 (não revela existência de conta)
    if (!user) {
      return res.status(200).json(safeMsg);
    }

    // Cooldown simples (evita spam): 60s entre envios
    const now = new Date();
    if (user.resetCodeLastSentAt) {
      const diffMs = now.getTime() - new Date(user.resetCodeLastSentAt).getTime();
      if (diffMs < 60 * 1000) {
        return res.status(200).json(safeMsg);
      }
    }

    // Código 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Hash do código (com pepper opcional)
    const pepper = process.env.RESET_PASSWORD_PEPPER || '';
    const hash = crypto.createHash('sha256').update(code + pepper).digest('hex');

    // Expira em 15 min
    const expires = new Date(now.getTime() + 15 * 60 * 1000);

    user.resetCodeHash = hash;
    user.resetCodeExpires = expires;
    user.resetCodeLastSentAt = now;
    user.resetCodeAttempts = 0;
    await user.save();

    // Envio via Resend (HTML simples)
    const subject = 'Seu código de recuperação de senha (WorshipHub)';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
        <h2 style="margin:0 0 12px 0;">Recuperação de senha</h2>
        <p style="margin:0 0 10px 0;">Use o código abaixo para redefinir sua senha:</p>
        <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:14px 18px; background:#f5f5f5; display:inline-block; border-radius:10px;">
          ${code}
        </div>
        <p style="margin:14px 0 0 0; color:#444;">Este código expira em <strong>15 minutos</strong>.</p>
        <p style="margin:10px 0 0 0; color:#777; font-size:12px;">Se você não solicitou isso, pode ignorar este e-mail.</p>
      </div>
    `;

    try {
      await sendEmail({ to: normalizedEmail, subject, html, text: `Seu código de recuperação: ${code} (expira em 15 min)` });
    } catch (e) {
      console.error('[forgotPassword] Falha ao enviar e-mail:', e?.message || e);
      // Mantém resposta genérica (não expõe falha para o usuário)
    }

    return res.status(200).json(safeMsg);
  } catch (err) {
    console.error('[forgotPassword] Erro:', err.message);
    // Ainda assim retorna genérico para evitar enumeração
    return res.status(200).json({ message: 'Se existir uma conta com este e-mail, enviaremos um código de recuperação.' });
  }
};

// 🔁 Confirmar recuperação e definir nova senha
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
    }

        const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+resetCodeHash +resetCodeExpires +resetCodeLastSentAt +resetCodeAttempts');

    if (!user) {
      return res.status(400).json({ message: 'Código inválido ou expirado' });
    }

    // Bloqueio por tentativas (5)
    const attempts = Number(user.resetCodeAttempts || 0);
    if (attempts >= 5) {
      return res.status(429).json({ message: 'Muitas tentativas. Solicite um novo código.' });
    }

    // Verificar expiração
    if (!user.resetCodeHash || !user.resetCodeExpires || new Date(user.resetCodeExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Código inválido ou expirado' });
    }

    const pepper = process.env.RESET_PASSWORD_PEPPER || '';
    const hash = crypto.createHash('sha256').update(String(code).trim() + pepper).digest('hex');

    if (hash !== user.resetCodeHash) {
      user.resetCodeAttempts = attempts + 1;
      await user.save();
      return res.status(400).json({ message: 'Código inválido ou expirado' });
    }

    // Trocar senha
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;

    // Limpar campos de reset
    user.resetCodeHash = undefined;
    user.resetCodeExpires = undefined;
    user.resetCodeLastSentAt = undefined;
    user.resetCodeAttempts = 0;

    await user.save();

    return res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (err) {
    console.error('[resetPassword] Erro:', err.message);
    return res.status(500).json({ message: 'Erro interno ao redefinir senha' });
  }
};
