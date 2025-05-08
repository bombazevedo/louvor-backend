// controllers/eventController.js
const Event = require('../models/Event');

const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json(event);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento.' });
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, location, date, notes, type, status } = req.body;
    if (!title || !date) {
      return res.status(400).json({ message: 'Título e data são obrigatórios.' });
    }

    const newEvent = new Event({
      title,
      location,
      date,
      description: notes,
      type: type || 'culto',
      status: status || 'agendado',
      createdBy: req.user?.id || null,
    });

    const saved = await newEvent.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento.' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.json({ message: 'Evento excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    res.status(500).json({ message: 'Erro ao excluir evento.' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
};
