const Repertoire = require('../models/Repertoire');
const Song = require('../models/Song');

exports.listarHistorico = async (req, res) => {
  try {
    const repertorios = await Repertoire.find().populate('songs');
    const historico = {};

    for (const rep of repertorios) {
      for (const musica of rep.songs) {
        const id = musica._id.toString();

        if (!historico[id]) {
          historico[id] = {
            id: id,
            nome: musica.nome,
            artista: musica.artista,
            album: musica.album,
            tonalidade: musica.tonalidade,
            bpm: musica.bpm,
            duracao: musica.duracao,
            albumCoverUrl: musica.albumCoverUrl,
            cifras: musica.cifras,
            links: musica.links,
            qtdTocada: 1
          };
        } else {
          historico[id].qtdTocada++;
        }
      }
    }

    res.json(Object.values(historico));
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de músicas' });
  }
};
