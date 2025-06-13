const Event = require('../models/Event');

// Histórico baseado nos links musicais dos eventos
exports.listarHistorico = async (req, res) => {
  try {
    const eventos = await Event.find().select('musicLinks');

    const historico = {};

    for (const evento of eventos) {
      for (const link of evento.musicLinks || []) {
        const id = link.url;

        if (!historico[id]) {
          historico[id] = {
            id: id,
            nome: link.name || 'Desconhecida',
            artista: link.artist || 'Desconhecido',
            plataforma: link.platform || 'Indefinido',
            url: link.url,
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
