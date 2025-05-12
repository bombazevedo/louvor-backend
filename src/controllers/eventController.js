const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');

exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id }).populate('members.user', 'name email');

        let podeVer = false;

        if (userRole === 'coordenador') {
          podeVer = true;
        } else if (userRole === 'dm' || userRole === 'usuario') {
          const escalado = scale?.members?.some(
            m => (m.user?._id?.toString() || m.user?.toString()) === userId
          );
          podeVer = escalado;
        }

        if (!podeVer) return null;

        const eventObj = event.toObject();
        eventObj.members = [];

        // Garantia manual dos nomes:
        if (scale?.members?.length > 0) {
          for (const m of scale.members) {
            const isObject = typeof m.user === 'object' && m.user !== null;
            const userData = isObject ? m.user : await User.findById(m.user).select('name');
            eventObj.members.push({
              user: {
                _id: userData._id,
                name: userData.name
              },
              function: m.function,
              confirmed: m.confirmed
            });
          }
        }

        return eventObj;
      })
    );

    const filtered = eventsWithScales.filter(Boolean);

    res.status(200).json(filtered);
  } catch (err) {
    console.error('Erro ao buscar eventos com escalas:', err.message);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};
