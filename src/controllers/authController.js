const User = require("../models/User");

// 🔐 Retorna o usuário pelo ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Erro ao obter usuário:", err.message);
    res.status(500).json({ message: "Erro ao buscar usuário" });
  }
};

// ✏️ Atualiza informações do usuário (incluindo avatar)
exports.updateUser = async (req, res) => {
  try {
    const {
      name,
      phone,
      birthDate,
      bio,
      socials,
      avatarUrl,
      avatarPublicId // ✅ novo campo suportado
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (birthDate) updates.birthDate = birthDate;
    if (bio) updates.bio = bio;
    if (socials) updates.socials = socials;
    if (avatarUrl) updates.avatarUrl = avatarUrl;
    if (avatarPublicId) updates.avatarPublicId = avatarPublicId;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "Usuário não encontrado" });

    res.json(updatedUser);
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err.message);
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
};

// 👮‍♂️ Atualiza o papel (role) do usuário
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Erro ao atualizar função do usuário:", err.message);
    res.status(500).json({ message: "Erro ao atualizar função" });
  }
};
