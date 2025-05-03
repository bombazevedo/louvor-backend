// backend/controllers/eventController.js
const Event = require("../models/Event");
const User = require("../models/User");
const Scale = require("../models/Scale");
const Repertoire = require("../models/Repertoire");
const Chat = require("../models/Chat");

const checkEventReadPermission = async (eventId, userId, userRole) => {
  const role = userRole.toLowerCase();
  if (role === "coordenador") return true;

  const event = await Event.findById(eventId).select("leader");
  if (!event) return false;

  if (role === "dm" && event.leader.toString() === userId) return true;

  const scale = await Scale.findOne({ event: eventId }).select("members.user");
  if (scale && scale.members.some(member => member.user.toString() === userId)) return true;

  return false;
};

const checkEventWritePermission = async (eventId, userId, userRole) => {
  const role = userRole.toLowerCase();
  if (role === "coordenador") return true;

  const event = await Event.findById(eventId).select("leader");
  if (!event) return false;

  if (role === "dm" && event.leader.toString() === userId) return true;

  return false;
};

const createEvent = async (req, res) => {
  try {
    const { title, description, date, endDate, location, type, leader, status, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role.toLowerCase();

    if (userRole !== "coordenador" && userRole !== "dm") {
      return res.status(403).json({ message: "Apenas Coordenadores ou DMs podem criar eventos." });
    }

    let finalLeader = leader;
    if (userRole === "dm" && leader !== createdBy) {
      return res.status(400).json({ message: "DMs só podem criar eventos onde são os líderes." });
    }

    if (!title || !date || !location || !finalLeader) {
      return res.status(400).json({ message: "Campos obrigatórios não fornecidos." });
    }

    const leaderExists = await User.findById(finalLeader);
    if (!leaderExists) {
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
      createdBy
    });

    const savedEvent = await newEvent.save();
    const populatedEvent = await Event.findById(savedEvent._id)
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
    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    let events;

    if (userRole === "coordenador") {
      events = await Event.find()
        .populate("leader", "name")
        .populate("createdBy", "name")
        .sort({ date: 1 });
    } else if (userRole === "dm") {
      events = await Event.find({ leader: userId })
        .populate("leader", "name")
        .populate("createdBy", "name")
        .sort({ date: 1 });
    } else {
      const scaleEvents = await Scale.find({ "members.user": userId }).select("event");
      const eventIds = scaleEvents.map(s => s.event);

      events = await Event.find({ _id: { $in: eventIds } })
        .populate("leader", "name")
        .populate("createdBy", "name")
        .sort({ date: 1 });
    }

    res.status(200).json(events);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({ message: "Erro interno ao buscar eventos." });
  }
};

const getEventById = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventReadPermission(eventId, userId, userRole);
    if (!hasPermission) {
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
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
      const exists = await Event.findById(eventId).select("_id");
      if (!exists) return res.status(404).json({ message: "Evento não encontrado para atualização." });
      return res.status(403).json({ message: "Sem permissão para atualizar este evento." });
    }

    const updateData = { ...req.body };
    delete updateData.createdBy;

    if (userRole.toLowerCase() !== "coordenador" && updateData.leader && updateData.leader !== userId) {
      return res.status(403).json({ message: "DMs só podem se definir como líderes." });
    }

    updateData.updatedAt = Date.now();

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("leader", "name")
      .populate("createdBy", "name");

    if (!updatedEvent) {
      return res.status(404).json({ message: "Evento não encontrado para atualização." });
    }

    res.status(200).json(updatedEvent);
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "ID inválido." });
    }
    res.status(500).json({ message: "Erro interno ao atualizar evento." });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasPermission = await checkEventWritePermission(eventId, userId, userRole);
    if (!hasPermission) {
      const exists = await Event.findById(eventId).select("_id");
      if (!exists) return res.status(404).json({ message: "Evento não encontrado." });
      return res.status(403).json({ message: "Sem permissão para excluir este evento." });
    }

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) return res.status(404).json({ message: "Evento não encontrado." });

    await Scale.deleteOne({ event: eventId });
    await Repertoire.deleteOne({ event: eventId });
    await Chat.deleteMany({ event: eventId });

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
