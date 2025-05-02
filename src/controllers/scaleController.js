const Scale = require("../models/Scale");
const Event = require("../models/Event");
const User = require("../models/User");

// --- Funções Auxiliares de Permissão (Adaptadas de eventController) ---

// Verifica permissão de LEITURA para Escala/Repertório associado a um evento
const checkReadPermission = async (eventId, userId, userRole) => {
  if (userRole === 'Coordenador') {
    return true; // Coordenador pode ler tudo
  }

  const event = await Event.findById(eventId).select('leader');
  if (!event) return false;

  // Verificar se é DM e líder do evento
  if (userRole === 'DM' && event.leader.toString() === userId) {
    return true;
  }

  // Verificar se é membro e está na escala
  const scale = await Scale.findOne({ event: eventId }).select('members.userId');
  if (scale && scale.members.some(member => member.userId.toString() === userId)) {
    return true;
  }

  return false;
};

// Verifica permissão de ESCRITA (Criar/Update/Delete) para Escala/Repertório associado a um evento
const checkWritePermission = async (eventId, userId, userRole) => {
  if (userRole === 'Coordenador') {
    return true; // Coordenador pode escrever
  }

  const event = await Event.findById(eventId).select('leader');
  if (!event) return false;

  // Verificar se é DM e líder do evento
  if (userRole === 'DM' && event.leader.toString() === userId) {
    return true;
  }

  return false; // Membros comuns não podem escrever
};

// --- Controlador de Escala com Permissões --- 

// Criar nova escala para um evento
exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

    // Verificar permissão para criar/modificar escala (Coordenador ou DM líder do evento)
    const hasPermission = await checkWritePermission(eventId, createdBy, userRole);
    if (!hasPermission) {
        const eventExists = await Event.findById(eventId).select('_id');
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para criar/modificar a escala deste evento.' });
    }

    if (!eventId || !members || !Array.isArray(members)) {
      return res.status(400).json({ message: "ID do evento e lista de membros (members) são obrigatórios." });
    }

    // Evento já validado em checkWritePermission se não for Coordenador
    if (userRole === 'Coordenador') {
        const eventExists = await Event.findById(eventId).select('_id');
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const validatedMembers = [];
    for (const item of members) {
      if (!item.userId || !item.function) {
        return res.status(400).json({ message: "Cada item em 'members' deve ter 'userId' (ID do usuário) e 'function'." });
      }
      const userExists = await User.findById(item.userId);
      if (!userExists) {
        return res.status(404).json({ message: `Usuário com ID ${item.userId} não encontrado.` });
      }
      validatedMembers.push({
        userId: item.userId,
        function: item.function,
        confirmed: item.confirmed || false,
        notes: item.notes
      });
    }

    const existingScale = await Scale.findOne({ event: eventId });
    if (existingScale) {
      return res.status(409).json({ message: "Já existe uma escala para este evento. Use a rota de atualização (PATCH)." });
    }

    const newScale = new Scale({
      event: eventId,
      members: validatedMembers,
      notes,
      createdBy
    });

    const savedScale = await newScale.save();
    const populatedScale = await Scale.findById(savedScale._id)
                                    .populate("event", "title date location")
                                    .populate("members.userId", "name email")
                                    .populate("createdBy", "name");

    res.status(201).json(populatedScale);
  } catch (error) {
    console.error("Erro ao criar escala:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID do evento ou usuário inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao criar escala." });
  }
};

// Listar todas as escalas (Acesso Geral - Coordenador vê tudo)
// TODO: Refinar se DMs/Membros devem ver apenas escalas de eventos que participam/lideram?
// Por enquanto, Coordenador vê tudo, outros não acessam esta rota (ou veem vazio).
exports.getAllScales = async (req, res) => {
  try {
    if (req.user.role !== 'Coordenador') {
        // Ou retornar vazio [], ou erro 403. Vamos retornar vazio.
        return res.status(200).json([]);
        // return res.status(403).json({ message: 'Acesso negado. Apenas Coordenadores podem listar todas as escalas.' });
    }
    const scales = await Scale.find()
                             .populate("event", "title date")
                             .populate("createdBy", "name")
                             .sort({ createdAt: -1 });
    res.status(200).json(scales);
  } catch (error) {
    console.error("Erro ao buscar escalas:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar escalas." });
  }
};

// Buscar escala por ID (Verifica permissão de leitura do evento associado)
exports.getScaleById = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const scale = await Scale.findById(scaleId)
                           .populate("event", "title date location leader") // Precisa do leader para checkReadPermission
                           .populate("members.userId", "name email role")
                           .populate("createdBy", "name email");

    if (!scale) {
      return res.status(404).json({ message: "Escala não encontrada." });
    }

    // Verificar permissão de leitura no evento associado
    const hasPermission = await checkReadPermission(scale.event._id.toString(), userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver a escala deste evento.' });
    }

    res.status(200).json(scale);
  } catch (error) {
    console.error("Erro ao buscar escala por ID:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID da escala inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao buscar escala." });
  }
};

// Buscar escala por ID do Evento (Verifica permissão de leitura do evento)
exports.getScaleByEventId = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verificar permissão de leitura no evento
    const hasPermission = await checkReadPermission(eventId, userId, userRole);
    if (!hasPermission) {
        const eventExists = await Event.findById(eventId).select('_id');
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver a escala deste evento.' });
    }

    const scale = await Scale.findOne({ event: eventId })
                           .populate("event", "title date location")
                           .populate("members.userId", "name email role")
                           .populate("createdBy", "name email");

    // Não é 404 se não existir, apenas retorna null
    res.status(200).json(scale);

  } catch (error) {
    console.error("Erro ao buscar escala por Evento ID:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID do evento inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao buscar escala." });
  }
};

// Atualizar escala por ID (Verifica permissão de escrita no evento associado)
exports.updateScale = async (req, res) => {
  try {
    const { members, notes } = req.body;
    const scaleId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const scale = await Scale.findById(scaleId).select('event'); // Obter ID do evento associado
    if (!scale) {
        return res.status(404).json({ message: "Escala não encontrada para atualização." });
    }
    const eventId = scale.event.toString();

    // Verificar permissão de escrita no evento associado
    const hasPermission = await checkWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para modificar a escala deste evento.' });
    }

    // Validar membros se fornecidos
    let validatedMembers = undefined;
    if (members && Array.isArray(members)) {
        validatedMembers = [];
        for (const item of members) {
            if (!item.userId || !item.function) {
                return res.status(400).json({ message: "Cada item em 'members' deve ter 'userId' e 'function'." });
            }
            const userExists = await User.findById(item.userId);
            if (!userExists) {
                return res.status(404).json({ message: `Usuário com ID ${item.userId} não encontrado.` });
            }
            validatedMembers.push({
                userId: item.userId,
                function: item.function,
                confirmed: item.confirmed === undefined ? false : item.confirmed,
                notes: item.notes
            });
        }
    }

    const updateData = {};
    if (validatedMembers !== undefined) updateData.members = validatedMembers;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "Nenhum dado válido fornecido para atualização." });
    }
    updateData.updatedAt = Date.now();

    const updatedScale = await Scale.findByIdAndUpdate(
      scaleId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("event", "title date")
     .populate("members.userId", "name email")
     .populate("createdBy", "name");

    // A escala foi encontrada antes, então updatedScale deve existir se o update funcionou
    res.status(200).json(updatedScale);

  } catch (error) {
    console.error("Erro ao atualizar escala:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID da escala ou usuário inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao atualizar escala." });
  }
};

// Deletar escala por ID (Verifica permissão de escrita no evento associado)
exports.deleteScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const scale = await Scale.findById(scaleId).select('event');
    if (!scale) {
        return res.status(404).json({ message: "Escala não encontrada para exclusão." });
    }
    const eventId = scale.event.toString();

    // Verificar permissão de escrita no evento associado
    const hasPermission = await checkWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para excluir a escala deste evento.' });
    }

    const deletedScale = await Scale.findByIdAndDelete(scaleId);
    // Não precisa verificar deletedScale novamente, pois já foi encontrado

    res.status(200).json({ message: "Escala excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir escala:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID da escala inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao excluir escala." });
  }
};

