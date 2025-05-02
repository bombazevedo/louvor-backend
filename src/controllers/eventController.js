const Event = require("../models/Event");
const User = require("../models/User");
const Scale = require("../models/Scale");
const Repertoire = require("../models/Repertoire");
<<<<<<< HEAD
const Chat = require("../models/Chat");

const checkEventReadPermission = async (eventId, userId, userRole) => {
  if (userRole === "Coordenador") return true;

  const event = await Event.findById(eventId).select("leader");
  if (!event) return false;

  if (userRole === "DM" && event.leader.toString() === userId) return true;

  const scale = await Scale.findOne({ event: eventId }).select("members.userId");
  if (scale && scale.members.some((member) => member.userId.toString() === userId)) return true;
=======
const Chat = require("../models/Chat"); // ✅ Importação corrigida

const checkEventReadPermission = async (eventId, userId, userRole) => {
  if (userRole === 'Coordenador') return true;

  const event = await Event.findById(eventId).select('leader');
  if (!event) return false;

  if (userRole === 'DM' && event.leader.toString() === userId) return true;

  const scale = await Scale.findOne({ event: eventId }).select('members.userId');
  if (scale && scale.members.some(member => member.userId.toString() === userId)) return true;
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb

  return false;
};

const checkEventWritePermission = async (eventId, userId, userRole) => {
<<<<<<< HEAD
  if (userRole === "Coordenador") return true;

  const event = await Event.findById(eventId).select("leader");
  if (!event) return false;

  if (userRole === "DM" && event.leader.toString() === userId) return true;
=======
  if (userRole === 'Coordenador') return true;

  const event = await Event.findById(eventId).select('leader');
  if (!event) return false;

  if (userRole === 'DM' && event.leader.toString() === userId) return true;
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb

  return false;
};

<<<<<<< HEAD
const createEvent = async (req, res) => {
=======
exports.createEvent = async (req, res) => {
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
  try {
    const { title, description, date, endDate, location, type, leader, status, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

<<<<<<< HEAD
    if (userRole !== "Coordenador" && userRole !== "DM") {
      return res.status(403).json({ message: "Apenas Coordenadores ou DMs podem criar eventos." });
    }

    let finalLeader = leader;
    if (userRole === "DM" && leader !== createdBy) {
      return res.status(400).json({ message: "DMs só podem criar eventos onde são os líderes." });
    }

    if (!title || !date || !location || !finalLeader) {
      return res.status(400).json({ message: "Campos obrigatórios não fornecidos." });
=======
    if (userRole !== 'Coordenador' && userRole !== 'DM') {
      return res.status(403).json({ message: 'Apenas Coordenadores ou DMs podem criar eventos.' });
    }

    let finalLeader = leader;
    if (userRole === 'DM' && leader !== createdBy) {
      return res.status(400).json({ message: 'DMs só podem criar eventos onde são os líderes.' });
    }

    if (!title || !date || !location || !finalLeader) {
      return res.status(400).json({ message: 'Campos obrigatórios não fornecidos.' });
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
    }

    const leaderExists = await User.findById(finalLeader);
    if (!leaderExists) {
<<<<<<< HEAD
      return res.status(404).json({ message: "Líder não encontrado." });
    }

    const newEvent = new Event({
      title,
      description,
      date,
      endDate,
      location,
      type,
      leader: finalLeader,
      status,
      notes,
      createdBy,
=======
      return res.status(404).json({ message: 'Líder não encontrado.' });
    }

    const newEvent = new Event({
      title, description, date, endDate, location, type,
      leader: finalLeader, status, notes, createdBy
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
    });

    const savedEvent = await newEvent.save();
    const populatedEvent = await Event.findById(savedEvent._id)
<<<<<<< HEAD
      .populate("leader", "name")
      .populate("createdBy", "name");

    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(500).json({ message: "Erro interno ao criar evento." });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("leader", "name")
      .populate("createdBy", "name")
      .sort({ date: 1 });

    res.status(200).json(events);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({ message: "Erro interno ao buscar eventos." });
  }
};

const getEventById = async (req, res) => {
=======
      .populate('leader', 'name')
      .populate('createdBy', 'name');

    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro interno ao criar evento.' });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate('leader', 'name')
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.status(200).json(events);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro interno ao buscar eventos.' });
  }
};

exports.getEventById = async (req, res) => {
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventReadPermission(eventId, userId, userRole);
    if (!hasPermission) {
<<<<<<< HEAD
      const exists = await Event.findById(eventId).select("_id");
      if (!exists) return res.status(404).json({ message: "Evento não encontrado." });
      return res.status(403).json({ message: "Sem permissão para acessar este evento." });
    }

    const event = await Event.findById(eventId)
      .populate("leader", "name email")
      .populate("createdBy", "name email");

    if (!event) return res.status(404).json({ message: "Evento não encontrado." });

    res.status(200).json(event);
  } catch (error) {
    console.error("Erro ao buscar evento por ID:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "ID inválido." });
    }
    res.status(500).json({ message: "Erro interno ao buscar evento." });
  }
};

const updateEvent = async (req, res) => {
=======
      const exists = await Event.findById(eventId).select('_id');
      if (!exists) return res.status(404).json({ message: 'Evento não encontrado.' });
      return res.status(403).json({ message: 'Sem permissão para acessar este evento.' });
    }

    const event = await Event.findById(eventId)
      .populate('leader', 'name email')
      .populate('createdBy', 'name email');

    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });

    res.status(200).json(event);
  } catch (error) {
    console.error('Erro ao buscar evento por ID:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID inválido.' });
    }
    res.status(500).json({ message: 'Erro interno ao buscar evento.' });
  }
};

exports.updateEvent = async (req, res) => {
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
<<<<<<< HEAD
      const exists = await Event.findById(eventId).select("_id");
      if (!exists) return res.status(404).json({ message: "Evento não encontrado." });
      return res.status(403).json({ message: "Sem permissão para atualizar este evento." });
=======
      const exists = await Event.findById(eventId).select('_id');
      if (!exists) return res.status(404).json({ message: 'Evento não encontrado.' });
      return res.status(403).json({ message: 'Sem permissão para atualizar este evento.' });
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
    }

    const updateData = { ...req.body };
    delete updateData.createdBy;

<<<<<<< HEAD
    if (userRole !== "Coordenador" && updateData.leader && updateData.leader !== userId) {
      return res.status(403).json({ message: "DMs só podem se definir como líderes." });
=======
    if (userRole !== 'Coordenador' && updateData.leader && updateData.leader !== userId) {
      return res.status(403).json({ message: 'DMs só podem se definir como líderes.' });
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
    }

    updateData.updatedAt = Date.now();

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true, runValidators: true }
<<<<<<< HEAD
    )
      .populate("leader", "name")
      .populate("createdBy", "name");

    if (!updatedEvent) {
      return res.status(404).json({ message: "Evento não encontrado para atualização." });
=======
    ).populate('leader', 'name').populate('createdBy', 'name');

    if (!updatedEvent) {
      return res.status(404).json({ message: 'Evento não encontrado para atualização.' });
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
    }

    res.status(200).json(updatedEvent);
  } catch (error) {
<<<<<<< HEAD
    console.error("Erro ao atualizar evento:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "ID inválido." });
    }
    res.status(500).json({ message: "Erro interno ao atualizar evento." });
  }
};

const deleteEvent = async (req, res) => {
=======
    console.error('Erro ao atualizar evento:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID inválido.' });
    }
    res.status(500).json({ message: 'Erro interno ao atualizar evento.' });
  }
};

exports.deleteEvent = async (req, res) => {
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
<<<<<<< HEAD
      const exists = await Event.findById(eventId).select("_id");
      if (!exists) return res.status(404).json({ message: "Evento não encontrado." });
      return res.status(403).json({ message: "Sem permissão para excluir este evento." });
    }

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) return res.status(404).json({ message: "Evento não encontrado." });
=======
      const exists = await Event.findById(eventId).select('_id');
      if (!exists) return res.status(404).json({ message: 'Evento não encontrado.' });
      return res.status(403).json({ message: 'Sem permissão para excluir este evento.' });
    }

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) return res.status(404).json({ message: 'Evento não encontrado.' });
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb

    await Scale.deleteOne({ event: eventId });
    await Repertoire.deleteOne({ event: eventId });
    await Chat.deleteMany({ event: eventId });

<<<<<<< HEAD
    res.status(200).json({ message: "Evento e dados associados excluídos com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir evento:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "ID inválido." });
    }
    res.status(500).json({ message: "Erro interno ao excluir evento." });
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
// Force redeploy 🚀
=======
    res.status(200).json({ message: 'Evento e dados associados excluídos com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID inválido.' });
    }
    res.status(500).json({ message: 'Erro interno ao excluir evento.' });
  }
};
>>>>>>> acdc2b05f41c3ffa7d6e79f90c0097f801838dfb
