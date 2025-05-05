const Event = require('../models/Event');
const Scale = require('../models/Scale');

exports.deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    // Remove o evento
    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    // Remove também a escala associada
    await Scale.deleteOne({ eventId });

    res.status(200).json({ message: 'Evento e escala associada excluídos com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    res.status(500).json({ message: 'Erro ao excluir evento.' });
  }
};