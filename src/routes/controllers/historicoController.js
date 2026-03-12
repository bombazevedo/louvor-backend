const Event = require('../models/Event');
const { getEntitlementsFor } = require('../utils/entitlements');

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

// 🔑 Dias de histórico por plano
function getHistoryDays(ent) {
  const inTrial = !!ent?.inTrial;
  if (inTrial) return null; // trial vê tudo

  // ✅ Fonte de verdade (quando existir): entitlements.limits.repertoireHistoryDays
  const fromLimits = ent?.limits?.repertoireHistoryDays;
  if (fromLimits === null) return null; // null = ilimitado
  if (fromLimits !== undefined) {
    const n = Number(fromLimits);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const plan = String(ent?.plan || 'FREE').toUpperCase();

  // ✅ Fallback (tabela padrão do projeto)
  // FREE → 7 dias
  if (plan === 'FREE') return 7;

  // Planos → (ajuste para ficar coerente com a regra do histórico)
  if (plan === '1') return 30;
  if (plan === '2') return 60;
  if (plan === '3') return 90;
  if (plan === '4') return 180;
  if (plan === '5') return 365;

  // fallback conservador
  return 7;
}

function getHistoryRange(ent, queryStart, queryEnd) {
  const now = new Date();
  const historyDays = getHistoryDays(ent);

  let minByPlan = null;
  if (historyDays != null) {
    minByPlan = new Date(now.getTime() - historyDays * 24 * 60 * 60 * 1000);
  }

  let from = null;
  let to = now;

  if (queryStart) {
    const s = new Date(queryStart);
    if (!isNaN(s.getTime())) {
      from = minByPlan ? (s > minByPlan ? s : minByPlan) : s;
    }
  } else if (minByPlan) {
    from = minByPlan;
  }

  if (queryEnd) {
    const e = new Date(queryEnd);
    if (!isNaN(e.getTime()) && e < now) {
      to = e;
    }
  }

  return { from, to };
}

exports.listarHistorico = async (req, res) => {
  try {
    const { start, end } = req.query || {};

    // 🔑 entitlements da organização atual (se orgContext estiver ativo)
    const org = req._org || null;
    const ent = req.entitlements || (org ? getEntitlementsFor(org) : getEntitlementsFor({}));
    req.entitlements = ent; // mantém disponível adiante

    const { from, to } = getHistoryRange(ent, start, end);

    const filtro = {
      musicLinks: { $exists: true, $ne: [] }
    };

    if (from || to) {
      filtro.date = {};
      if (from) filtro.date.$gte = from;
      if (to) filtro.date.$lte = to;
    }

    // opcional: se orgContext estiver em uso, filtra por organização
    if (req.orgId) {
      filtro.org = req.orgId;
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
    const { start, end } = req.query || {};

    const org = req._org || null;
    const ent = req.entitlements || (org ? getEntitlementsFor(org) : getEntitlementsFor({}));
    req.entitlements = ent;

    const { from, to } = getHistoryRange(ent, start, end);

    const filtro = {
      musicLinks: { $exists: true, $ne: [] }
    };

    if (from || to) {
      filtro.date = {};
      if (from) filtro.date.$gte = from;
      if (to) filtro.date.$lte = to;
    }

    if (req.orgId) {
      filtro.org = req.orgId;
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
