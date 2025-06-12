
const mongoose = require('mongoose');
const Repertoire = require("../models/Repertoire");
const Event = require("../models/Event");
const Song = require("../models/Song");
const User = require("../models/User");
const Scale = require("../models/Scale"); // Needed for permission checks

// --- Funções Auxiliares de Permissão (Adaptadas de eventController) ---

const checkReadPermission = async (eventId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return false;
  if (userRole === 'Coordenador') return true;

  const event = await Event.findById(eventId).select('leader').lean();
  if (!event) return false;

  if (userRole === 'DM' && event.leader.toString() === userId) return true;

  const scale = await Scale.findOne({ event: eventId }).select('members.userId').lean();
  return scale && scale.members.some(member => member.userId.toString() === userId);
};

const checkWritePermission = async (eventId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return false;
  if (userRole === 'Coordenador') return true;

  const event = await Event.findById(eventId).select('leader').lean();
  return event && userRole === 'DM' && event.leader.toString() === userId;
};

exports.createRepertoire = async (req, res) => {
  try {
    const { eventId, songs, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkWritePermission(eventId, createdBy, userRole);
    if (!hasPermission) {
      const eventExists = await Event.findById(eventId).select('_id').lean();
      if (!eventExists) return res.status(404).json({ message: 'Evento não encontrado.' });
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    if (!eventId || !songs || !Array.isArray(songs)) {
      return res.status(400).json({ message: "ID do evento e lista de músicas (songs) são obrigatórios." });
    }

    const validatedSongs = [];
    for (const item of songs) {
      if (!item.song || item.order === undefined) {
        return res.status(400).json({ message: "Cada item em 'songs' deve ter 'song' (ID da música) e 'order'." });
      }
      const songExists = await Song.findById(item.song).select('_id').lean();
      if (!songExists) {
        return res.status(404).json({ message: `Música com ID ${item.song} não encontrada.` });
      }
      validatedSongs.push(item);
    }

    const existingRepertoire = await Repertoire.findOne({ event: eventId }).select('_id').lean();
    if (existingRepertoire) {
      return res.status(409).json({ message: "Já existe um repertório para este evento." });
    }

    const newRepertoire = new Repertoire({ event: eventId, songs: validatedSongs, notes, createdBy });
    const saved = await newRepertoire.save();

    const populated = await Repertoire.findById(saved._id)
      .populate("event", "title date location")
      .populate("songs.song", "title artist")
      .populate("createdBy", "name");

    res.status(201).json(populated);
  } catch (error) {
    console.error("Erro ao criar repertório:", error);
    res.status(500).json({ message: "Erro interno ao criar repertório." });
  }
};

exports.getAllRepertoires = async (req, res) => {
  try {
    if (req.user.role !== 'Coordenador') return res.status(200).json([]);
    const repertoires = await Repertoire.find()
      .populate("event", "title date")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });
    res.status(200).json(repertoires);
  } catch (error) {
    console.error("Erro ao buscar repertórios:", error);
    res.status(500).json({ message: "Erro interno ao buscar repertórios." });
  }
};

exports.getRepertoireById = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role: userRole } = req.user;

    const repertoire = await Repertoire.findById(id)
      .populate("event", "title date location leader")
      .populate("songs.song", "title artist key")
      .populate("createdBy", "name email");

    if (!repertoire) return res.status(404).json({ message: "Repertório não encontrado." });

    const hasPermission = await checkReadPermission(repertoire.event._id.toString(), userId, userRole);
    if (!hasPermission) return res.status(403).json({ message: 'Acesso negado.' });

    res.status(200).json(repertoire);
  } catch (error) {
    console.error("Erro ao buscar repertório por ID:", error);
    res.status(500).json({ message: "Erro interno ao buscar repertório." });
  }
};

exports.getRepertoireByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const hasPermission = await checkReadPermission(eventId, userId, userRole);
    if (!hasPermission) return res.status(403).json({ message: 'Acesso negado.' });

    const repertoire = await Repertoire.findOne({ event: eventId })
      .populate("event", "title date location")
      .populate("songs.song", "title artist key")
      .populate("createdBy", "name email");

    res.status(200).json(repertoire);
  } catch (error) {
    console.error("Erro ao buscar repertório por Evento ID:", error);
    res.status(500).json({ message: "Erro interno ao buscar repertório." });
  }
};

exports.updateRepertoire = async (req, res) => {
  try {
    const { id } = req.params;
    const { songs, notes } = req.body;
    const { id: userId, role: userRole } = req.user;

    const repertoire = await Repertoire.findById(id).select('event').lean();
    if (!repertoire) return res.status(404).json({ message: "Repertório não encontrado." });

    const hasPermission = await checkWritePermission(repertoire.event.toString(), userId, userRole);
    if (!hasPermission) return res.status(403).json({ message: 'Acesso negado.' });

    let validatedSongs = undefined;
    if (songs !== undefined) {
      if (!Array.isArray(songs)) return res.status(400).json({ message: "songs deve ser um array." });
      validatedSongs = [];
      for (const item of songs) {
        if (!item.song || item.order === undefined) {
          return res.status(400).json({ message: "Cada item deve ter 'song' e 'order'." });
        }
        const exists = await Song.findById(item.song).select('_id').lean();
        if (!exists) return res.status(404).json({ message: `Música com ID ${item.song} não encontrada.` });
        validatedSongs.push(item);
      }
    }

    const updateData = {};
    if (validatedSongs !== undefined) updateData.songs = validatedSongs;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedAt = Date.now();

    const updated = await Repertoire.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
      .populate("event", "title date")
      .populate("songs.song", "title artist")
      .populate("createdBy", "name");

    res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao atualizar repertório:", error);
    res.status(500).json({ message: "Erro interno ao atualizar repertório." });
  }
};

exports.deleteRepertoire = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role: userRole } = req.user;

    const repertoire = await Repertoire.findById(id).select('event').lean();
    if (!repertoire) return res.status(404).json({ message: "Repertório não encontrado." });

    const hasPermission = await checkWritePermission(repertoire.event.toString(), userId, userRole);
    if (!hasPermission) return res.status(403).json({ message: 'Acesso negado.' });

    await Repertoire.findByIdAndDelete(id);
    res.status(200).json({ message: "Repertório excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir repertório:", error);
    res.status(500).json({ message: "Erro interno ao excluir repertório." });
  }
};
