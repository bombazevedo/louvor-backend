
// backend/controllers/eventController.js
const Event = require('../models/Event');
const Scale = require('../models/Scale');

// GET /api/events
const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user', 'name email');

        return {
          ...event.toObject(),
          members: scale?.members || []
        };
      })
    );

    res.status(200).json(eventsWithScales);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });
    res.status(200).json(event);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento.' });
  }
};

// PATCH /api/events/:id
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, minister } = req.body;
    const eventId = req.params.id;

    const updated = await Event.findByIdAndUpdate(
      eventId,
      {
        ...(title && { title }),
        ...(description && { description }),
        ...(date && { date }),
        ...(minister && { minister }),
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
};

// DELETE /api/events/:id
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    await Scale.deleteOne({ eventId });

    res.status(200).json({ message: 'Evento e escala associada excluídos com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    res.status(500).json({ message: 'Erro ao excluir evento.' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
};
