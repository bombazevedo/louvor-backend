const Event = require("../models/Event");
const User = require("../models/User");
const Scale = require("../models/Scale");
const Repertoire = require("../models/Repertoire");
const Chat = require("../models/Chat");

const checkEventReadPermission = async (eventId, userId, userRole) => {
  const role = userRole.toLowerCase();
  if (role === "coordenador") return true;

  const scale = await Scale.findOne({ event: eventId }).select("members.user");
  if (scale && scale.members.some(member => member.user.toString() === userId)) return true;

  return false;
};

const checkEventWritePermission = async (eventId, userId, userRole) => {
  const role = userRole.toLowerCase();
  if (role === "coordenador") return true;

  const scale = await Scale.findOne({ event: eventId }).select("members.user");
  if (role === "dm" && scale && scale.members.some(member => member.user.toString() === userId)) return true;

  return false;
};

const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      endDate,
      location,
      type,
      status,
      notes,
      members = []
    } = req.body;

    const createdBy = req.user.id;
    const userRole = req.user.role.toLowerCase();

    if (userRole !== "coordenador") {
      return res.status(403).json({ message: "Apenas Coordenadores podem criar eventos." });
    }

    if (!title || !date || !location) {
      return res.status(400).json({ message: "Campos obrigatórios não fornecidos." });
    }

    const newEvent = new Event({
      title,
      description,
      date,
      endDate,
      location,
      type,
      status,
      notes,
      createdBy
    });

    const savedEvent = await newEvent.save();

    if (Array.isArray(members) && members.length > 0) {
      const validatedMembers = [];

      for (const item of members) {
        if (!item.userId || !item.function) {
          return res.status(400).json({ message: "Cada membro precisa de userId e function." });
        }

        const userExists = await User.findById(item.userId);
        if (!userExists) {
          return res.status(404).json({ message: `Usuário com ID ${item.userId} não encontrado.` });
        }

        validatedMembers.push({
          user: item.userId, // Corrigido de userId para user
          function: item.function,
          confirmed: false,
        });
      }

      const newScale = new Scale({
        event: savedEvent._id,
        members: validatedMembers,
        createdBy
      });

      await newScale.save();
    }

    const populatedEvent = await Event.findById(savedEvent._id).populate("createdBy", "name");

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
        .populate("createdBy", "name")
        .sort({ date: 1 });
    } else {
      const scaleEvents = await Scale.find({ "members.user": userId }).select("event");
      const eventIds = scaleEvents.map(s => s.event);

      events = await Event.find({ _id: { $in: eventIds } })
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
      if (exists) return res.status(403).json({ message: "Sem permissão para acessar este evento." });
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    const event = await Event.findById(eventId).populate("createdBy", "name email");

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

    updateData.updatedAt = Date.now();

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("createdBy", "name");

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
