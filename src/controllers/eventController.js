const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');
const BandRole = require('../models/BandRole');

// GET /api/events
exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id }).lean();

        if (scale && scale.members && scale.members.length > 0) {
          const populatedMembers = await Promise.all(
            scale.members.map(async (member) => {
              const user = await User.findById(member.user).select('name email photoUrl');
              const func = await BandRole.findById(member.function).select('name');
              return { ...member, user: user || null, function: func || null };
            })
          );
          scale.members = populatedMembers;
        }

        let podeVer = false;
        if (userRole === 'coordenador') {
          podeVer = true;
        } else {
          const escalado = scale && scale.members && scale.members.some(m =>
            (m.user && m.user._id?.toString?.()) === userId
          );
          podeVer = escalado;
        }

        if (!podeVer) return null;

        const eventObj = event.toObject();
        eventObj.scale = scale || { members: [] };
        eventObj.members = scale?.members || [];

        return eventObj;
      })
    );

    const filtered = eventsWithScales.filter(e => e !== null);
    res.status(200).json(filtered);
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
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    let scale = await Scale.findOne({ eventId: event._id }).lean();

    if (scale?.members?.length > 0) {
      const populatedMembers = await Promise.all(
        scale.members.map(async (member) => {
          try {
            const user = await User.findById(member.user).select('name email photoUrl');
            const func = await BandRole.findById(member.function).select('name');
            return { ...member, user: user || null, function: func || null };
          } catch {
            return { ...member, user: null, function: null };
          }
        })
      );
      scale.members = populatedMembers;
    } else {
      scale = { members: [] };
    }

    const isCoordinator = userRole === 'coordenador';
    const isEscalado = scale.members?.some(
      (m) => m.user?._id?.toString() === userId
    );

    if (!isCoordinator && !isEscalado) {
      return res.status(403).json({ message: 'Sem permissão para visualizar este evento.' });
    }

    const eventObj = event.toObject();
    eventObj.scale = scale;
    eventObj.members = scale.members;

    res.status(200).json(eventObj);
  } catch (err) {
    console.error('🔥 ERRO getEventById:', err.message);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
};

// PATCH /api/events/:id
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate({
      path: 'scale',
      populate: { path: 'members.user' }
    });

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();
    const isCoordinator = userRole === 'coordenador';
    const isEscalado = event.scale?.members?.some(
      (m) => m.user?._id?.toString() === userId
    );

    if (!isCoordinator && !isEscalado) {
      return res.status(403).json({ message: 'Sem permissão para editar este evento.' });
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });

    res.json(updatedEvent);
  } catch (err) {
    console.error('🔥 ERRO updateEvent:', err.message);
    res.status(500).json({ message: 'Erro ao atualizar evento.' });
  }
};
