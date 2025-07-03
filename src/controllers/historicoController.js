const Event = require('../models/Event');

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/(\(ao vivo.*?\)|- ao vivo|ao vivo|feat\..*|clipe oficial|video oficial|\|.*|\[.*?\])/gi, '') // remove sufixos
    .replace(/[^a-z0-9 ]/gi, '') // remove símbolos
    .replace(/\s+/g, ' ') // normaliza espaços
    .trim();
}

function formatarNome(texto) {
  return texto
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

exports.listarHistorico = async (req, res) => {
  try {
    const hoje = new Date();
    const { start, end } = req.query;

    const filtro = {
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    };

    if (start || end) {
      filtro.date = {};
      if (start) filtro.date.$gte = new Date(start);
      if (end) filtro.date.$lte = new Date(end);
    }

    const eventos = await Event.find(filtro).select('musicLinks');

    const mapa = new Map();

    for (const evento of eventos) {
      for (const musica of evento.musicLinks || []) {
        if (!musica.name || !musica.artist) continue;

        const nomeNormalizado = normalizarTexto(musica.name);
        const artistaNormalizado = normalizarTexto(musica.artist);

        // Remove artista do nome se estiver duplicado
        const nomeSemArtista = nomeNormalizado.replace(artistaNormalizado, '').trim();
        const chave = `${nomeSemArtista} ${artistaNormalizado}`.trim();

        if (!mapa.has(chave)) {
          mapa.set(chave, {
            nomeOriginal: musica.name,
            artistaOriginal: musica.artist,
            qtdTocada: 1,
            links: [musica]
          });
        } else {
          const item = mapa.get(chave);
          item.qtdTocada += 1;
          item.links.push(musica);
        }
      }
    }

    const resultado = Array.from(mapa.values()).map(item => {
      const youtube = item.links.find(link => link.platform?.toLowerCase() === 'youtube');
      const preferido = youtube || item.links[0];

      return {
        id: preferido.url,
        nome: formatarNome(normalizarTexto(item.nomeOriginal)),
        artista: formatarNome(normalizarTexto(item.artistaOriginal)),
        plataforma: preferido.platform,
        url: preferido.url,
        qtdTocada: item.qtdTocada
      };
    });

    res.status(200).json(resultado);
  } catch (err) {
    console.error('Erro ao gerar histórico:', err);
    res.status(500).json({ error: 'Erro ao gerar histórico de músicas' });
  }
};

exports.listarExecucoesIndividuais = async (req, res) => {
  try {
    const hoje = new Date();
    const { start, end } = req.query;

    const filtro = {
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    };

    if (start || end) {
      filtro.date = {};
      if (start) filtro.date.$gte = new Date(start);
      if (end) filtro.date.$lte = new Date(end);
    }

    const eventos = await Event.find(filtro).select('musicLinks date');

    const execucoes = [];

    for (const evento of eventos) {
      for (const musica of evento.musicLinks || []) {
        if (!musica.name || !musica.artist) continue;

        execucoes.push({
          nome: musica.name,
          artista: musica.artist,
          plataforma: musica.platform,
          url: musica.url,
          eventoId: evento._id,
          dataExecucao: evento.date
        });
      }
    }

    res.status(200).json(execucoes);
  } catch (err) {
    console.error('Erro ao listar execuções:', err);
    res.status(500).json({ error: 'Erro ao listar execuções' });
  }
};
