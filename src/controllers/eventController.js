
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');

// GET /api/events
exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id }).lean();

        if (scale && scale.members && scale.members.length > 0) {
          const populatedMembers = await Promise.all(scale.members.map(async (member) => {
            const user = await User.findById(member.user).select('name email');
            return { ...member, user: user || null };
          }));
          scale.members = populatedMembers;
        }

        let podeVer = false;
        if (userRole === 'coordenador') {
          podeVer = true;
        } else {
          const escalado = scale && scale.members && scale.members.some(m =>
            ((m.user && m.user._id && m.user._id.toString && m.user._id.toString()) || (m.user && m.user.toString && m.user.toString())) === userId
          );
          podeVer = escalado;
        }

        if (!podeVer) return null;

        const eventObj = event.toObject();
        delete eventObj.members;
        eventObj.scale = scale || { members: [] };
        eventObj.members = scale && scale.members ? scale.members : [];

        return eventObj;
      })
    );

    const filtered = eventsWithScales.filter(e => e !== null);
    res.status(200).json(filtered); // <-- RETORNO CORRETO
  } catch (err) {
    console.error('🔥 ERRO getEventsWithScales:', err.message);
    console.error(err.stack);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};

// GET /api/events/:id
exports.getEventById = async (req, res) => {
  try {
    console.log('📡 Buscando evento por ID:', req.params.id);
    const event = await Event.findById(req.params.id);

    if (!event) {
      console.warn('⚠️ Evento não encontrado');
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    let scale = await Scale.findOne({ eventId: event._id }).lean();

    if (scale && scale.members && scale.members.length > 0) {
      const populatedMembers = await Promise.all(
        scale.members.map(async (member) => {
          try {
            const user = await User.findById(member.user).select('name email');
            return { ...member, user: user || null };
          } catch {
            return { ...member, user: null };
          }
        })
      );
      scale.members = populatedMembers;
    } else {
      scale = { members: [] };
    }

    const eventObj = event.toObject();
    delete eventObj.members;
    eventObj.scale = scale;
    eventObj.members = scale.members;

    res.status(200).json(eventObj);
  } catch (err) {
    console.error('🔥 ERRO getEventById:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
};
// alteração forçada para commit

