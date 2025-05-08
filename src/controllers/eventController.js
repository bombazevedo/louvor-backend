const Event = require('../models/eventModel');

// GET /events
const getEvents = async (req, res) => {
  try {
    const events = await Event.find().populate('members.user');
    res.json(events);
  } catch (error) {
    console.error('Erro ao obter eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// GET /events/:id
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('members.user');
    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json(event);
  } catch (error) {
    console.error('Erro ao obter evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento.' });
  }
};

// POST /events
const createEvent = async (req, res) => {
  try {
    const { title, location, date, type, status, notes } = req.body;
    if (!title || !location || !date) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    }

    const event = new Event({ title, location, date, type, status, notes });
    const savedEvent = await event.save();

    res.status(201).json(savedEvent);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento.' });
  }
};

// PATCH /events/:id
const updateEvent = async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    }).populate('members.user');

    if (!updatedEvent) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json(updatedEvent);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
};

// DELETE /events/:id
const deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json({ message: 'Evento deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    res.status(500).json({ message: 'Erro ao deletar evento.' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent, // ✅ agora incluído
  updateEvent,
  deleteEvent
};
