const Event = require('../models/Event');
const Scale = require('../models/Scale');

exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user', 'name email');

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

        // ⚠️ Apagar membros antigos, mas manter compatibilidade
        delete eventObj.members;

        // ✅ Inclui o campo 'scale'
        eventObj.scale = scale || { members: [] };

        // ✅ Para compatibilidade: adiciona 'members' espelhando a escala
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
