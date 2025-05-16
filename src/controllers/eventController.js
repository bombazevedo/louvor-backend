
const Event = require('../models/Event');
const Scale = require('../models/Scale');

// GET /api/events
exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const events = await Event.find()
      .populate({
        path: 'scale',
        options: { strictPopulate: false },
        populate: [
          { path: 'members.user', select: 'name email', options: { strictPopulate: false } }
        ]
      }).sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate({
            path: 'members.user',
            select: 'name email',
            options: { strictPopulate: false }
          });

        let podeVer = false;
        if (userRole === 'coordenador') {
          podeVer = true;
        } else {
          const escalado = scale?.members?.some(m =>
            (m.user?._id?.toString?.() || m.user?.toString?.()) === userId
          );
          podeVer = escalado;
        }

        if (!podeVer) return null;

        const eventObj = event.toObject();
        delete eventObj.members;
        eventObj.scale = scale || { members: [] };
        eventObj.members = scale?.members || [];

        return eventObj;
      })
    );

    const filtered = eventsWithScales.filter(e => e !== null);
    res.status(200).json(filtered);
  } catch (err) {
    console.error('Erro ao buscar eventos com escalas:', err.message);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// GET /api/events/:id
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'scale',
        options: { strictPopulate: false },
        populate: [
          { path: 'members.user', select: 'name email', options: { strictPopulate: false } }
        ]
      });

    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id })
      .populate({
        path: 'members.user',
        select: 'name email',
        options: { strictPopulate: false }
      });

    const eventObj = event.toObject();
    delete eventObj.members;
    eventObj.scale = scale || { members: [] };
    eventObj.members = scale?.members || [];

    res.status(200).json(eventObj);
  } catch (err) {
    console.error('Erro ao buscar evento por ID:', err.message, err.stack);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
};
