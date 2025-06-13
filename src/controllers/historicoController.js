const Event = require('../models/Event');

// Listar histórico consolidado de músicas tocadas (eventos passados)
exports.listarHistorico = async (req, res) => {
  try {
    const hoje = new Date();

    // Buscar somente eventos já passados que tenham musicLinks
    const eventosPassados = await Event.find({
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    }).select('musicLinks');

    const historicoMap = new Map();

    for (const evento of eventosPassados) {
      for (const musica of evento.musicLinks) {
        const chave = `${musica.name.trim().toLowerCase()}___${musica.artist.trim().toLowerCase()}`;

        if (!historicoMap.has(chave)) {
          historicoMap.set(chave, {
            nome: musica.name,
            artista: musica.artist,
            qtdTocada: 1,
            links: [musica]
          });
        } else {
          const item = historicoMap.get(chave);
          item.qtdTocada += 1;
          item.links.push(musica); // Armazena todos os links para avaliação posterior
        }
      }
    }

    const resultado = Array.from(historicoMap.values()).map((item) => {
      // Verifica se algum dos links é do YouTube
      const youtube = item.links.find(link => link.platform.toLowerCase() === 'youtube');
      let plataformaFinal = '';
      let urlFinal = '';

      if (youtube) {
        plataformaFinal = youtube.platform;
        urlFinal = youtube.url;
      } else {
        // Se não há YouTube, retorna o primeiro link usado
        const fallback = item.links[0];
        plataformaFinal = fallback.platform;
        urlFinal = fallback.url;
      }

      return {
        id: urlFinal,
        nome: item.nome,
        artista: item.artista,
        plataforma: plataformaFinal,
        url: urlFinal,
        qtdTocada: item.qtdTocada
      };
    });

    res.status(200).json(resultado);
  } catch (err) {
    console.error('Erro ao gerar histórico:', err);
    res.status(500).json({ error: 'Erro ao gerar histórico de músicas' });
  }
};
