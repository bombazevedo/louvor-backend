const User = require('../models/User');
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

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role.toLowerCase()
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

// 🎚 Atualizar função (somente coordenador)
exports.updateUserRole = async (req, res) => {
  try {
    if (req.user.role?.toLowerCase() !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem alterar funções.' });
    }

    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role: role.toLowerCase() },
      { new: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.status(200).json({ message: 'Função atualizada com sucesso.', user: updatedUser });
  } catch (err) {
    console.error('[updateUserRole] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao atualizar função do usuário' });
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
    const month = new Date().getMonth();
    const users = await User.find(
      { birthDate: { $exists: true } },
      { name: 1, birthDate: 1, photoUrl: 1 }
    );

    const birthdays = users.filter(u => {
      const d = new Date(u.birthDate);
      return d.getMonth() === month;
    });

    res.status(200).json(birthdays);
    } catch (err) {
    console.error('[getBirthdays] Erro ao buscar aniversariantes:', err.message);
    res.status(500).json({ message: 'Erro ao buscar aniversariantes' });
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
