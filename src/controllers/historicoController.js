const Event = require('../models/Event');

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(ao vivo.*?\)|\(live.*?\)|feat\..*|\[.*?\]/gi, '') // remove (Ao Vivo), feat. etc.
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

    const eventos = await Event.find({
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    }).select('musicLinks');

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
