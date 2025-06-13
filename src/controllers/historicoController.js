const Event = require('../models/Event');

// Listar histórico de músicas tocadas em eventos passados
exports.listarHistorico = async (req, res) => {
  try {
    const hoje = new Date();

    // Buscar somente eventos cuja data seja anterior à data atual e que contenham músicas
    const eventosPassados = await Event.find({
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    }).select('musicLinks');

    const historico = {};

    for (const evento of eventosPassados) {
      for (const musica of evento.musicLinks) {
        const id = musica.url; // Usa a URL como identificador único da música

        if (!historico[id]) {
          historico[id] = {
            id: musica.url,
            nome: musica.name,
            artista: musica.artist,
            plataforma: musica.platform,
            url: musica.url,
            qtdTocada: 1
          };
        } else {
          historico[id].qtdTocada++;
        }
      }
    }

    res.status(200).json(Object.values(historico));
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de músicas' });
  }
};
