const Event = require('../models/Event');

// Função utilitária para normalizar nome + artista
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(ao vivo.*?\)|\(live.*?\)|feat\..*|\[.*?\]/gi, '') // remove "ao vivo", "feat", etc.
    .replace(/[^a-z0-9 ]/gi, '') // remove caracteres especiais
    .replace(/\s+/g, ' ') // normaliza espaços
    .trim();
}

// Função principal exportada corretamente
exports.listarHistorico = async (req, res) => {
  try {
    const hoje = new Date();

    const eventosPassados = await Event.find({
      date: { $lt: hoje },
      musicLinks: { $exists: true, $ne: [] }
    }).select('musicLinks');

    const historicoMap = new Map();

    for (const evento of eventosPassados) {
      for (const musica of evento.musicLinks || []) {
        if (!musica.name || !musica.artist) continue;

        const chave = normalizarTexto(`${musica.name} ${musica.artist}`);

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
          item.links.push(musica);
        }
      }
    }

    const resultado = Array.from(historicoMap.values()).map(item => {
      const youtube = item.links.find(link => link.platform?.toLowerCase() === 'youtube');
      const preferido = youtube || item.links[0];

      return {
        id: preferido.url,
        nome: item.nome,
        artista: item.artista,
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
