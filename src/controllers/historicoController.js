const Event = require('../models/Event');
const MusicHistory = require('../models/MusicHistory');

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(ao vivo.*?\)|\(live.*?\)|feat\..*|\[.*?\]/gi, '')
    .replace(/[^a-z0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
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

    const filtroData = { date: { $lt: hoje } };
    if (start || end) {
      filtroData.date = {};
      if (start) filtroData.date.$gte = new Date(start);
      if (end) filtroData.date.$lte = new Date(end);
    }

    const eventos = await Event.find({
      ...filtroData,
      musicLinks: { $exists: true, $ne: [] }
    }).select('musicLinks date');

    const mapa = new Map();

    for (const evento of eventos) {
      for (const musica of evento.musicLinks || []) {
        if (!musica.name || !musica.artist) continue;

        const nomeNormalizado = normalizarTexto(musica.name);
        const artistaNormalizado = normalizarTexto(musica.artist);
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

        // 🟢 NOVO: Registrar cada execução individualmente no MusicHistory
        await MusicHistory.create({
          nome: musica.name,
          artista: musica.artist,
          plataforma: musica.platform,
          url: musica.url,
          eventoId: evento._id,
          dataExecucao: evento.date
        });
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
    const { start, end } = req.query;
    const filtro = {};

    if (start || end) {
      filtro.dataExecucao = {};
      if (start) filtro.dataExecucao.$gte = new Date(start);
      if (end) filtro.dataExecucao.$lte = new Date(end);
    }

    const execucoes = await MusicHistory.find(filtro).sort({ dataExecucao: -1 });
    res.status(200).json(execucoes);
  } catch (err) {
    console.error('Erro ao buscar execuções:', err);
    res.status(500).json({ error: 'Erro ao buscar execuções' });
  }
};
