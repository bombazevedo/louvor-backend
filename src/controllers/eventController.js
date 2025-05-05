const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');

// GET /api/events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate('minister', 'name email')
      .sort({ date: 1 });

    const eventsWithScales = await Promise.all(events.map(async event => {
      const scale = await Scale.findOne({ eventId: event._id })
        .populate('members.user', 'name email');

      return {
        ...event.toObject(),
        members: scale?.members || []
      };
    }));

    res.status(200).json(eventsWithScales);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// PATCH /api/events/:id
exports.updateEvent = async (req, res) => {
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
    ).populate('minister', 'name email');

    if (!updated) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
};