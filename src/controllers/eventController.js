const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');
const Function = require('../models/BandRole');

const getEventsWithScales = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id }).populate('members.user').populate('members.function');
        const eventObj = event.toObject();
        eventObj.scale = scale;
        return eventObj;
      })
    );

    res.json(eventsWithScales);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos' });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id }).populate('members.user').populate('members.function');
    const eventObj = event.toObject();
    eventObj.scale = scale;

    res.json(eventObj);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento' });
  }
};

module.exports = {
  getEventsWithScales,
  getEventById,
};
