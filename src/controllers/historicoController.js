// historicoController.js atualizado com lógica aprimorada para agrupar músicas por nome e artista, ignorando variações como "Ao Vivo", "feat", etc.

const Event = require('../models/Event');

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(ao vivo.*?\)|\(live.*?\)|feat\..*|\[.*?\]/gi, '') // remove (Ao Vivo), feat. e colchetes
    .replace(/[^a-z0-9 ]/gi, '') // remove caracteres especiais
    .replace(/\s+/g, ' ') // normaliza espaços múltiplos
    .trim();
}

exports.getHistoricoMusicas = async (req, res) => {
  try {
    const eventos = await Event.find({ date: { $lt: new Date() } })
      .select('musicLinks')
      .lean();

    const contador = new Map();

    for (const evento of eventos) {
      for (const musica of evento.musicLinks || []) {
        const chaveNormalizada = normalizarTexto(musica.name + musica.artist);

        if (!contador.has(chaveNormalizada)) {
          contador.set(chaveNormalizada, {
            id: musica.url,
            nome: musica.name,
            artista: musica.artist,
            plataforma: musica.platform,
            url: musica.url,
            qtdTocada: 1
          });
        } else {
          const entradaExistente = contador.get(chaveNormalizada);

          // Se o novo link for YouTube e o atual não, atualiza para o YouTube
          if (musica.platform === 'YouTube' && entradaExistente.plataforma !== 'YouTube') {
            entradaExistente.id = musica.url;
            entradaExistente.nome = musica.name;
            entradaExistente.artista = musica.artist;
            entradaExistente.plataforma = musica.platform;
            entradaExistente.url = musica.url;
          }

          entradaExistente.qtdTocada += 1;
        }
      }
    }

    const historico = Array.from(contador.values())
      .sort((a, b) => b.qtdTocada - a.qtdTocada || a.nome.localeCompare(b.nome));

    res.json(historico);
  } catch (error) {
    console.error('Erro ao gerar histórico:', error);
    res.status(500).json({ message: 'Erro ao gerar histórico de músicas.' });
  }
};
