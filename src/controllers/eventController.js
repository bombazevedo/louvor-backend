const Event = require('../models/Event');
const Scale = require('../models/Scale');

// 🔍 Retorna eventos visíveis conforme papel e escala
exports.getEventsWithScales = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🎯 [getEventsWithScales] Requisição de eventos feita por: ${userRole} (${userId})`);

    const events = await Event.find().sort({ date: 1 });
    console.log(`📦 Total de eventos encontrados: ${events.length}`);

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id }).populate('members.user', 'name email');

        let podeVer = false;

        if (userRole === 'coordenador') {
          podeVer = true;
        } else {
          const escalado = scale?.members?.some(
            m => {
              const match = m.user?._id?.toString() === userId || m.user?.toString() === userId;
              if (match) {
                console.log(`✅ Evento visível para ${userRole}: ${event.title} (ID ${event._id})`);
              }
              return match;
            }
          );
          podeVer = escalado;
        }

        if (!podeVer) {
          console.log(`⛔ Evento oculto para ${userRole}: ${event.title} (ID ${event._id})`);
          return null;
        }

        const eventObj = event.toObject();
        eventObj.members = scale?.members || [];

        return eventObj;
      })
    );

    const filtered = eventsWithScales.filter(e => e !== null);
    console.log(`📊 Eventos retornados para ${userRole}: ${filtered.length}`);

    res.status(200).json(filtered);
  } catch (err) {
    console.error('❌ Erro ao buscar eventos com escalas:', err.message);
    res.status(500).json({ message: 'Erro ao buscar eventos.' });
  }
};
