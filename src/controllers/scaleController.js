// scaleController.js
const Scale = require("../models/Scale");
const Event = require("../models/Event");
const User = require("../models/User");

// --- Funções Auxiliares de Permissão ---
const checkReadPermission = async (eventId, userId, userRole) => {
  if (userRole === 'Coordenador') return true;
  const scale = await Scale.findOne({ event: eventId }).select('members.userId');
  return scale && scale.members.some(m => m.userId.toString() === userId);
};

const checkWritePermission = async (eventId, userId, userRole) => {
  if (userRole === 'Coordenador') return true;
  const scale = await Scale.findOne({ event: eventId }).select('members.userId');
  return scale && scale.members.some(m => m.userId.toString() === userId);
};

// --- Nova Função: Criação de Evento + Escala via Seleção ---
exports.createFromSelection = async (req, res) => {
  try {
    const { title, date, type, status, members, notes } = req.body;
    const createdBy = req.user.id;

    if (!title || !date || !members || members.length === 0) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    }

    const resolvedMembers = [];
    for (const m of members) {
      const user = await User.findOne({ email: m.email });
      if (!user) {
        console.warn(`Usuário com email ${m.email} não encontrado. Ignorado.`);
        continue;
      }
      resolvedMembers.push({ userId: user._id, function: m.function });
    }

    if (resolvedMembers.length === 0) {
      return res.status(400).json({ message: 'Nenhum membro válido encontrado na escala.' });
    }

    const newEvent = new Event({
      title,
      date,
      type: type || 'culto',
      status: status || 'agendado',
      notes,
      createdBy
    });
    const savedEvent = await newEvent.save();

    const newScale = new Scale({
      event: savedEvent._id,
      members: resolvedMembers,
      createdBy
    });
    await newScale.save();

    res.status(201).json({
      message: 'Evento e escala criados com sucesso.',
      event: savedEvent,
      scale: newScale
    });
  } catch (error) {
    console.error("Erro ao criar evento/escala via selecao:", error);
    res.status(500).json({ message: "Erro interno ao criar evento e escala." });
  }
};

// 🔁 Suas outras funções continuam abaixo: createScale, getAllScales, getScaleById,
// getScaleByEventId, updateScale, deleteScale

// (mantenha todas essas como estavam no seu código original)

// ✅ Esse bloco acima adiciona a nova função e mantém todo o resto intacto.
