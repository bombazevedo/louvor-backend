
const Event = require('../models/Event');
const Scale = require('../models/Scale');

// Buscar todos os eventos
const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.status(200).json(events);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// Buscar evento por ID com escala populada
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });

    const scale = await Scale.findOne({ eventId: event._id }).populate('members.user', 'name email');

    const eventWithMembers = {
      ...event.toObject(),
      members: scale?.members || []
    };

    res.status(200).json(eventWithMembers);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento.' });
  }
};

// Criar novo evento
const createEvent = async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento.' });
  }
};

// Atualizar evento e escala relacionada
const updateEvent = async (req, res) => {
  try {
    const { musicLinks, attachments, members, ...eventData } = req.body;

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...eventData,
        musicLinks,
        attachments,
      },
      { new: true }
    );

    // Atualiza ou cria a escala vinculada
    await Scale.findOneAndUpdate(
      { eventId: req.params.id },
      { eventId: req.params.id, members },
      { upsert: true, new: true }
    );

    res.status(200).json(updatedEvent);
  } catch (error) {
    console.error('Erro ao atualizar evento e escala:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento e escala.' });
  }
};

// Deletar evento
const deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    await Scale.deleteOne({ eventId: req.params.id }); // opcional: limpar escala
    res.status(200).json({ message: 'Evento e escala deletados com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    res.status(500).json({ message: 'Erro ao deletar evento.' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
