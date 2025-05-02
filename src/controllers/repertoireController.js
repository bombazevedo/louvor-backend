const Repertoire = require("../models/Repertoire");
const Event = require("../models/Event");
const Song = require("../models/Song");
const User = require("../models/User");
const Scale = require("../models/Scale"); // Needed for permission checks

// --- Funções Auxiliares de Permissão (Adaptadas de eventController) ---

// Verifica permissão de LEITURA para Escala/Repertório associado a um evento
const checkReadPermission = async (eventId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return false; // Check for valid ID format
  if (userRole === 'Coordenador') {
    return true; // Coordenador pode ler tudo
  }

  const event = await Event.findById(eventId).select('leader').lean(); // Use lean for performance
  if (!event) return false;

  // Verificar se é DM e líder do evento
  if (userRole === 'DM' && event.leader.toString() === userId) {
    return true;
  }

  // Verificar se é membro e está na escala
  // Use lean and select only necessary fields
  const scale = await Scale.findOne({ event: eventId }).select('members.userId').lean();
  if (scale && scale.members.some(member => member.userId.toString() === userId)) {
    return true;
  }

  return false;
};

// Verifica permissão de ESCRITA (Criar/Update/Delete) para Escala/Repertório associado a um evento
const checkWritePermission = async (eventId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return false;
  if (userRole === 'Coordenador') {
    return true; // Coordenador pode escrever
  }

  const event = await Event.findById(eventId).select('leader').lean();
  if (!event) return false;

  // Verificar se é DM e líder do evento
  if (userRole === 'DM' && event.leader.toString() === userId) {
    return true;
  }

  return false; // Membros comuns não podem escrever
};

// --- Controlador de Repertório com Permissões ---

// Criar novo repertório para um evento
exports.createRepertoire = async (req, res) => {
  try {
    const { eventId, songs, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

    // Verificar permissão para criar/modificar repertório (Coordenador ou DM líder do evento)
    const hasPermission = await checkWritePermission(eventId, createdBy, userRole);
    if (!hasPermission) {
        const eventExists = await Event.findById(eventId).select('_id').lean();
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para criar/modificar o repertório deste evento.' });
    }

    if (!eventId || !songs || !Array.isArray(songs)) {
      return res.status(400).json({ message: "ID do evento e lista de músicas (songs) são obrigatórios." });
    }

    // Evento já validado em checkWritePermission se não for Coordenador
    if (userRole === 'Coordenador') {
        const eventExists = await Event.findById(eventId).select('_id').lean();
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const validatedSongs = [];
    for (const item of songs) {
      if (!item.song || item.order === undefined) { // Check order explicitly
        return res.status(400).json({ message: "Cada item em 'songs' deve ter 'song' (ID da música) e 'order'." });
      }
      const songExists = await Song.findById(item.song).select('_id').lean();
      if (!songExists) {
        return res.status(404).json({ message: `Música com ID ${item.song} não encontrada.` });
      }
      validatedSongs.push({
        song: item.song,
        order: item.order,
        key: item.key,
        notes: item.notes
      });
    }

    const existingRepertoire = await Repertoire.findOne({ event: eventId }).select('_id').lean();
    if (existingRepertoire) {
      return res.status(409).json({ message: "Já existe um repertório para este evento. Use a rota de atualização (PATCH)." });
    }

    const newRepertoire = new Repertoire({
      event: eventId,
      songs: validatedSongs,
      notes,
      createdBy
    });

    const savedRepertoire = await newRepertoire.save();
    const populatedRepertoire = await Repertoire.findById(savedRepertoire._id)
                                          .populate("event", "title date location")
                                          .populate("songs.song", "title artist")
                                          .populate("createdBy", "name");

    res.status(201).json(populatedRepertoire);
  } catch (error) {
    console.error("Erro ao criar repertório:", error);
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
        return res.status(400).json({ message: 'ID do evento ou música inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao criar repertório." });
  }
};

// Listar todos os repertórios (Acesso Geral - Coordenador vê tudo)
// TODO: Refinar se DMs/Membros devem ver apenas repertórios de eventos que participam/lideram?
exports.getAllRepertoires = async (req, res) => {
  try {
    if (req.user.role !== 'Coordenador') {
        return res.status(200).json([]); // Retorna vazio para não Coordenadores
        // return res.status(403).json({ message: 'Acesso negado. Apenas Coordenadores podem listar todos os repertórios.' });
    }
    const repertoires = await Repertoire.find()
                                    .populate("event", "title date")
                                    .populate("createdBy", "name")
                                    .sort({ createdAt: -1 });
    res.status(200).json(repertoires);
  } catch (error) {
    console.error("Erro ao buscar repertórios:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar repertórios." });
  }
};

// Buscar repertório por ID (Verifica permissão de leitura do evento associado)
exports.getRepertoireById = async (req, res) => {
  try {
    const repertoireId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const repertoire = await Repertoire.findById(repertoireId)
                                     .populate("event", "title date location leader") // Precisa do leader
                                     .populate("songs.song", "title artist key")
                                     .populate("createdBy", "name email");

    if (!repertoire) {
      return res.status(404).json({ message: "Repertório não encontrado." });
    }

    // Verificar permissão de leitura no evento associado
    const hasPermission = await checkReadPermission(repertoire.event._id.toString(), userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver o repertório deste evento.' });
    }

    res.status(200).json(repertoire);
  } catch (error) {
    console.error("Erro ao buscar repertório por ID:", error);
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
        return res.status(400).json({ message: 'ID do repertório inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao buscar repertório." });
  }
};

// Buscar repertório por ID do Evento (Verifica permissão de leitura do evento)
exports.getRepertoireByEventId = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verificar permissão de leitura no evento
    const hasPermission = await checkReadPermission(eventId, userId, userRole);
    if (!hasPermission) {
        const eventExists = await Event.findById(eventId).select('_id').lean();
        if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver o repertório deste evento.' });
    }

    const repertoire = await Repertoire.findOne({ event: eventId })
                                     .populate("event", "title date location")
                                     .populate("songs.song", "title artist key")
                                     .populate("createdBy", "name email");

    res.status(200).json(repertoire); // Retorna null se não encontrado

  } catch (error) {
    console.error("Erro ao buscar repertório por Evento ID:", error);
     if (error.kind === 'ObjectId' || error.name === 'CastError') {
        return res.status(400).json({ message: 'ID do evento inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao buscar repertório." });
  }
};


// Atualizar repertório por ID (Verifica permissão de escrita no evento associado)
exports.updateRepertoire = async (req, res) => {
  try {
    const { songs, notes } = req.body;
    const repertoireId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const repertoire = await Repertoire.findById(repertoireId).select('event').lean();
    if (!repertoire) {
        return res.status(404).json({ message: "Repertório não encontrado para atualização." });
    }
    const eventId = repertoire.event.toString();

    // Verificar permissão de escrita no evento associado
    const hasPermission = await checkWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para modificar o repertório deste evento.' });
    }

    // Validar músicas se fornecidas
    let validatedSongs = undefined;
    if (songs !== undefined) { // Permitir enviar array vazio para limpar
        if (!Array.isArray(songs)) {
            return res.status(400).json({ message: "O campo 'songs' deve ser um array." });
        }
        validatedSongs = [];
        for (const item of songs) {
            if (!item.song || item.order === undefined) {
                return res.status(400).json({ message: "Cada item em 'songs' deve ter 'song' (ID da música) e 'order'." });
            }
            const songExists = await Song.findById(item.song).select('_id').lean();
            if (!songExists) {
                return res.status(404).json({ message: `Música com ID ${item.song} não encontrada.` });
            }
            validatedSongs.push({
                song: item.song,
                order: item.order,
                key: item.key,
                notes: item.notes
            });
        }
    }

    const updateData = {};
    if (validatedSongs !== undefined) updateData.songs = validatedSongs;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "Nenhum dado válido fornecido para atualização (songs ou notes)." });
    }
    updateData.updatedAt = Date.now();

    const updatedRepertoire = await Repertoire.findByIdAndUpdate(
      repertoireId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("event", "title date")
     .populate("songs.song", "title artist")
     .populate("createdBy", "name");

    res.status(200).json(updatedRepertoire);

  } catch (error) {
    console.error("Erro ao atualizar repertório:", error);
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
        return res.status(400).json({ message: 'ID do repertório, evento ou música inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao atualizar repertório." });
  }
};

// Deletar repertório por ID (Verifica permissão de escrita no evento associado)
exports.deleteRepertoire = async (req, res) => {
  try {
    const repertoireId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const repertoire = await Repertoire.findById(repertoireId).select('event').lean();
    if (!repertoire) {
        return res.status(404).json({ message: "Repertório não encontrado para exclusão." });
    }
    const eventId = repertoire.event.toString();

    // Verificar permissão de escrita no evento associado
    const hasPermission = await checkWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para excluir o repertório deste evento.' });
    }

    await Repertoire.findByIdAndDelete(repertoireId);

    res.status(200).json({ message: "Repertório excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir repertório:", error);
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
        return res.status(400).json({ message: 'ID do repertório inválido.' });
    }
    res.status(500).json({ message: "Erro interno do servidor ao excluir repertório." });
  }
};

// Adicionar a importação do mongoose no início do arquivo se ainda não estiver lá
const mongoose = require('mongoose');

