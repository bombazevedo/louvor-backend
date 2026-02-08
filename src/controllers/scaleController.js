// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const moment = require('moment');
const puppeteer = require('puppeteer');

// ⬇️⬇️⬇️ ALTERAÇÕES CIRÚRGICAS (imports de notificação/push) ⬇️⬇️⬇️
const Notification = require('../models/Notification');
const pushService = require('../services/pushService');
// ⬆️⬆️⬆️ FIM DAS IMPORTAÇÕES NOVAS ⬆️⬆️⬆️

// 🔑 NOVO: entitlements (planos / trial)
const { getEntitlementsFor } = require('../utils/entitlements');

moment.locale('pt-br');

// ======================= CRUD Padrão =======================
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find({ org: req.orgId })
      .populate('members.user', 'name email photoUrl')
      .populate('members.function', 'name');
    res.json(scales);
  } catch (err) {
    console.error('[getAllScales] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escalas' });
  }
};

exports.getScaleById = async (req, res) => {
  try {
    const scale = await Scale.findOne({ _id: req.params.id, org: req.orgId })
      .populate('members.user', 'name email photoUrl')
      .populate('members.function', 'name');
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada' });
    res.json(scale);
  } catch (err) {
    console.error('[getScaleById] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escala do evento' });
  }
};

exports.getScaleByEventId = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, org: req.orgId })
      .populate({
        path: 'scale',
        populate: [
          { path: 'members.user', select: 'name email photoUrl' },
          { path: 'members.function', select: 'name' }
        ]
      });
    if (!event || !event.scale) {
      return res.status(404).json({ message: 'Escala não encontrada para este evento' });
    }
    res.json(event.scale);
  } catch (err) {
    console.error('[getScaleByEventId] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escala do evento' });
  }
};

// ⬇️⬇️⬇️ ALTERAÇÕES CIRÚRGICAS (helpers) ⬇️⬇️⬇️
function pickUserIds(members = []) {
  // members: [{ user: ObjectId|{_id}, function: ... }]
  return [...new Set(
    members
      .map(m => (m?.user?._id || m?.user || '').toString())
      .filter(Boolean)
  )];
}

async function notifyUserOfScale(userId, eventDoc, orgId) {
  try {
    const title = 'Escala Confirmada';
    const when = eventDoc?.date ? moment(eventDoc.date).format('DD/MM/YYYY') : '';
    const body = eventDoc?.title
      ? `Você foi escalado para "${eventDoc.title}" ${when ? `em ${when}` : ''}.`
      : `Você foi escalado${when ? ` em ${when}` : ''}.`;

    const orgIdStr = orgId ? String(orgId) : null;
    const relatedIdStr = eventDoc?._id?.toString?.() || '';

    // 1) Persistência
    await Notification.create({
      user: userId,
      org: orgId || undefined,
      title,
      message: body,
      type: 'scale',
      referenceModel: 'Event',
      reference: eventDoc?._id,
      data: {
        orgId: orgIdStr,
        relatedModel: 'Event',
        relatedId: relatedIdStr,
      },
      sentAt: new Date()
    });

    // 2) Push (não bloquear a request)
    pushService
      .sendUserPush(userId, {
        title,
        body,
        data: {
          orgId: orgIdStr,
          type: 'scale',
          relatedModel: 'Event',
          relatedId: relatedIdStr,
        }
      })
      .catch(err => {
        console.warn('[notifyUserOfScale] Falha no push (não bloqueante):', err?.message || err);
      });

  } catch (err) {
    console.warn('[notifyUserOfScale] Falha ao persistir/enviar notificação:', err?.message || err);
  }
}

// ⬇️ NOVO: notificação de REMOÇÃO de escala (top-level, fora da função acima)
async function notifyUserRemovedFromScale(userId, eventDoc, orgId) {
  try {
    const title = 'Atualização de Escala';
    const when = eventDoc?.date ? moment(eventDoc.date).format('DD/MM/YYYY') : '';
    const body = eventDoc?.title
      ? `Você foi removido de "${eventDoc.title}" ${when ? `(${when})` : ''}.`
      : `Você foi removido da escala${when ? ` (${when})` : ''}.`;

    const orgIdStr = orgId ? String(orgId) : null;
    const relatedIdStr = eventDoc?._id?.toString?.() || '';

    await Notification.create({
      user: userId,
      org: orgId || undefined,
      title,
      message: body,
      type: 'scale',
      referenceModel: 'Event',
      reference: eventDoc?._id,
      data: {
        orgId: orgIdStr,
        relatedModel: 'Event',
        relatedId: relatedIdStr,
        action: 'removed'
      },
      sentAt: new Date()
    });

    pushService
      .sendUserPush(userId, {
        title,
        body,
        data: {
          orgId: orgIdStr,
          type: 'scale',
          action: 'removed',
          relatedModel: 'Event',
          relatedId: relatedIdStr,
        }
      })
      .catch(() => {});
  } catch (_) {}
}

// ⬆️ FIM DOS HELPERS

exports.createScale = async (req, res) => {
  try {
    const scale = new Scale({
    org: req.orgId,
      eventId: req.body.eventId,
      members: req.body.members || [],
      notes: req.body.notes || ''
    });
    const newScale = await scale.save();

    if (req.body.eventId) {
      await Event.findOneAndUpdate(
{ _id: req.body.eventId, org: req.orgId },
{ scale: newScale._id }
);
    }

    // ⬇️⬇️⬇️ ALTERAÇÃO CIRÚRGICA: notificar membros iniciais ⬇️⬇️⬇️
    if (req.body.eventId && Array.isArray(req.body.members) && req.body.members.length > 0) {
  const eventDoc = await Event.findOne({ _id: req.body.eventId, org: req.orgId }).select('title date').lean();
  const userIds = pickUserIds(req.body.members);
  // dispara em paralelo, sem bloquear
  Promise.all(userIds.map(uid => notifyUserOfScale(uid, eventDoc, req.orgId))).catch(() => {});
}

    // ⬆️⬆️⬆️ FIM DA ALTERAÇÃO EM createScale ⬆️⬆️⬆️

    res.status(201).json(newScale);
  } catch (err) {
    console.error('[createScale] Erro:', err.message);
    res.status(400).json({ message: 'Erro ao criar escala' });
  }
};

exports.updateScale = async (req, res) => {
  try {
    const scale = await Scale.findOne({ _id: req.params.id, org: req.orgId });
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada' });

    // ⬇️⬇️⬇️ ALTERAÇÃO CIRÚRGICA: detectar novos **e removidos** membros ⬇️⬇️⬇️
const beforeUserIds = pickUserIds(scale.members);
let addedUserIds = [];
let removedUserIds = [];

if (req.body.members) {
  const afterUserIds = pickUserIds(req.body.members);
  addedUserIds   = afterUserIds.filter(id => !beforeUserIds.includes(id));
  removedUserIds = beforeUserIds.filter(id => !afterUserIds.includes(id));
  scale.members = req.body.members;
}
// ⬆️⬆️⬆️ FIM DA DETECÇÃO ⬆️⬆️⬆️


    if (typeof req.body.notes === 'string') scale.notes = req.body.notes;
    if (req.body.eventId) scale.eventId = req.body.eventId;

    const updated = await scale.save();

    // ⬇️⬇️⬇️ ALTERAÇÃO CIRÚRGICA: notificar adicionados **e** removidos ⬇️⬇️⬇️
const eventId = updated.eventId || req.body.eventId;
const eventDoc = eventId
  ? await Event.findOne({ _id: eventId, org: req.orgId }).select('title date').lean()
  : null;

if (addedUserIds.length > 0) {
  Promise.all(addedUserIds.map(uid => notifyUserOfScale(uid, eventDoc, req.orgId))).catch(() => {});
}
if (removedUserIds.length > 0) {
  Promise.all(removedUserIds.map(uid => notifyUserRemovedFromScale(uid, eventDoc, req.orgId))).catch(() => {});
}

// ⬆️⬆️⬆️ FIM DA ALTERAÇÃO EM updateScale ⬆️⬆️⬆️

    res.json(updated);
  } catch (err) {
    console.error('[updateScale] Erro:', err.message);
    res.status(400).json({ message: 'Erro ao atualizar escala' });
  }
};

exports.deleteScale = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id);
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada' });

    // captura usuários antes de deletar
    const removedUserIds = pickUserIds(scale.members);

    // tenta resolver o evento para mensagem (via eventId da escala ou referência do Event.scale)
let eventDoc = null;
if (scale.eventId) {
  eventDoc = await Event.findOne({ _id: scale.eventId, org: req.orgId }).select('title date').lean();
} else {
  const ev = await Event.findOne({ scale: scale._id, org: req.orgId }).select('title date').lean();
  eventDoc = ev || null;
}

    // desfaz ponte no(s) evento(s) e remove a escala
    await Event.updateMany({ scale: scale._id }, { $unset: { scale: '' } });
    await scale.deleteOne();

    // avisa todos que foram removidos
    if (removedUserIds.length && eventDoc) {
  Promise.all(
    removedUserIds.map(uid => notifyUserRemovedFromScale(uid, eventDoc, req.orgId))
  ).catch(() => {});
}

    res.json({ message: 'Escala removida com sucesso' });
  } catch (err) {
    console.error('[deleteScale] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao remover escala' });
  }
};


// ======================= Exportar PDF (Premium) =======================

function fmtDate(d) {
  return d ? moment(d).format('DD/MM/YYYY') : '';
}

function resolveDateRange(queryLike) {
  if (queryLike.start && queryLike.end) {
    const start = new Date(queryLike.start);
    const end = new Date(queryLike.end);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: `${fmtDate(start)} - ${fmtDate(end)}` };
  }

  const period = String(queryLike.period || 'month').toLowerCase();
  const ref = queryLike.ref ? new Date(queryLike.ref) : new Date();
  const m = moment(ref);

  if (period === 'quarter' || period === 'trimestre') {
    const q = Math.floor(m.month() / 3);
    const start = moment(m).month(q * 3).startOf('month').startOf('day').toDate();
    const end = moment(m).month(q * 3 + 2).endOf('month').endOf('day').toDate();
    return { start, end, label: `Trimestre ${q + 1}/${m.year()}` };
  }

  if (period === 'semester' || period === 'semestre') {
    const s = m.month() < 6 ? 1 : 2;
    const start = moment(m).month(s === 1 ? 0 : 6).startOf('month').startOf('day').toDate();
    const end = moment(m).month(s === 1 ? 5 : 11).endOf('month').endOf('day').toDate();
    return { start, end, label: `Semestre ${s}/${m.year()}` };
  }

  const start = moment(m).startOf('month').startOf('day').toDate();
  const end = moment(m).endOf('month').endOf('day').toDate();
  return { start, end, label: `${m.format('MMMM [de] YYYY')}` };
}

// ---------- ÍCONES (SVG inline) ----------
const SVG_ICONS = {
  minister: `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a3 3 0 110 6 3 3 0 010-6zm-7 16a7 7 0 1114 0H5z"/></svg>`,
  voice:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a3 3 0 110 6 3 3 0 010-6zM6 14a6 6 0 1112 0v2H6v-2z"/></svg>`,
  guitar:   `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M21 3l-2 2-1-1 2-2 1 1zM17 5l2 2-7.5 7.5a3 3 0 11-4.24-4.24L17 5zM5 19l3-3"/></svg>`,
  bass:     `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M21 3l-2 2-1-1 2-2 1 1zM17 5l2 2-7.5 7.5a3 3 0 11-4.24-4.24L17 5zM5 19l3-3"/></svg>`,
  piano:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M3 5h18v14H3zM7 19v-6h2v6M11 19v-6h2v6M15 19v-6h2v6"/></svg>`,
  keys:     `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M3 5h18v14H3zM8 19v-6h1v6M11.5 19v-6h1v6M15 19v-6h1v6"/></svg>`,
  drums:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M4 7l8-3 8 3-8 3-8-3zm2 6h12v6H6z"/></svg>`,
  perc:     `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/></svg>`,
  brass:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h10l7 3v-8l-7 3H3z"/></svg>`,
  strings:  `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M6 4h2v16H6zM10 4h2v16h-2zM14 4h2v16h-2z"/></svg>`,
  proj:     `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M12 17v2"/></svg>`,
  audio:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M5 10v4l4 3V7l-4 3zM15 9a3 3 0 010 6"/></svg>`,
  light:    `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a7 7 0 00-7 7c0 3.1 2 5.7 4.8 6.6L10 21h4l.2-4.4A7 7 0 0019 10a7 7 0 00-7-7z"/></svg>`,
  stream:   `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16v10H4z"/><path d="M10 9l6 4-6 4z"/></svg>`,
  location: `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`,
  note:     `<svg viewBox="0 0 24 24" class="svg" xmlns="http://www.w3.org/2000/svg"><path d="M9 3v12a4 4 0 104 4V9h4V3H9z"/></svg>`
};

// Ordem fixa de funções (nomes EXATOS)
const FIXED_FUNCTION_ORDER = [
  'Ministro',
  'Voz',
  'Back Vocal',
  'Guitarra',
  'Violão',
  'Baixo',
  'Teclado',
  'Piano',
  'Bateria',
  'Percussão',
  'Sopro',
  'Sax',
  'Trompete',
  'Violino',
  'Cello',
  'Multimídia',
  'Projeção',
  'Som',
  'Áudio',
  'Luz',
  'Transmissão'
];

// 🔧 NOVO: normalização igual ao frontend (NFD → sem acento → lower → trim)
function normalizeKey(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function functionIconSvg(name) {
  if (!name) return SVG_ICONS.note;
  const n = name.toLowerCase();
  if (n === 'ministro' || n === 'voz' || n === 'back vocal') return SVG_ICONS.minister;
  if (n === 'guitarra' || n === 'violão') return SVG_ICONS.guitar;
  if (n === 'baixo') return SVG_ICONS.guitar; // mesmo ícone de guitarra
  if (n === 'teclado') return SVG_ICONS.piano;
  if (n === 'piano') return SVG_ICONS.piano;
  if (n === 'bateria') return SVG_ICONS.drums;
  if (n === 'percussão') return SVG_ICONS.perc;
  if (n === 'sopro' || n === 'trompete') return SVG_ICONS.brass;
  if (n === 'sax' || n === 'violino' || n === 'cello') return SVG_ICONS.strings;
  if (n === 'multimídia' || n === 'projeção') return SVG_ICONS.proj;
  if (n === 'som' || n === 'áudio') return SVG_ICONS.audio;
  if (n === 'luz') return SVG_ICONS.light;
  if (n === 'transmissão') return SVG_ICONS.stream;
  return SVG_ICONS.note;
}

function safe(v) {
  return v == null ? '' : String(v);
}

function sortMembersFixed(members) {
  const orderIndex = new Map(FIXED_FUNCTION_ORDER.map((nm, i) => [nm, i]));
  return [...(members || [])].sort((a, b) => {
    const fa = a?.function?.name || '';
    const fb = b?.function?.name || '';
    const ia = orderIndex.has(fa) ? orderIndex.get(fa) : Number.MAX_SAFE_INTEGER;
    const ib = orderIndex.has(fb) ? orderIndex.get(fb) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return (a?.user?.name || '').localeCompare(b?.user?.name || '');
  });
}

// ---------- CSS ----------
function style() {
  const roxo = '#4B0082';
  const dourado = '#FFD700';
  const preto = '#000000';
  const branco = '#FFFFFF';
  const cinzaClaro = '#F7F7FB';
  const cinzaMedio = '#EAEAF2';

  return `
    @page { size: A4; margin: 18mm 12mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${preto}; }
    .svg { width: 14px; height: 14px; fill: currentColor; vertical-align: -2px; }
    .role-icon { width: 14px; height: 14px; object-fit: contain; vertical-align: -2px; } /* 🔧 NOVO */

    .header {
      background: linear-gradient(90deg, ${roxo} 0%, ${preto} 100%);
      color: ${branco}; padding: 16px 18px; border-radius: 12px;
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom: 14px;
    }
    .header .title { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
    .header .period { font-size: 12px; opacity: .95; text-align:right; }
    .header .period strong { color: ${dourado}; }

    .event-card {
      border: 1px solid ${dourado};
      border-radius: 14px;
      margin: 10px 0;
      overflow: hidden;
      background: ${branco};
    }
    .event-card.alt { background: ${cinzaClaro}; border-color: ${cinzaMedio}; }

    .event-header {
      background: ${roxo}; color: ${branco}; padding: 10px 12px;
      display:flex; align-items:center; justify-content:space-between;
    }
    .event-title { font-size: 16px; font-weight: 800; display:flex; align-items:center; gap:8px; }
    .badge {
      display:inline-block; padding: 2px 8px; font-size: 11px;
      border: 1px solid ${dourado}; border-radius: 999px; color: ${dourado}; background: #1f1033;
    }
    .event-info { font-size: 12px; opacity: .95; display:flex; align-items:center; gap:6px; }

    .event-body { padding: 10px 12px; }
    .row { display:flex; align-items:center; margin: 6px 0; }
    .role { width: 44%; font-weight:700; font-size: 13px; color:${roxo}; display:flex; align-items:center; gap:6px; }
    .member { width: 56%; font-size: 13px; display:flex; align-items:center; gap:6px; }
    .avatar { width:18px; height:18px; border-radius: 50%; object-fit: cover; border: 1px solid ${cinzaMedio}; }

    .footer { margin-top: 12px; font-size: 11px; color: #555; text-align: center; }
    .muted { opacity:.75; }
  `;
}

function resolveExportMode(ent) {
  const plan = String(ent?.plan || 'FREE').toUpperCase();
  const inTrial = !!ent?.inTrial;

  // Trial sempre vê o produto completo
  if (inTrial) return 'full';

  // FREE e Plano 1 → escala simples (nome + função, sem avatar)
  if (plan === 'FREE' || plan === '1') {
    return 'simple';
  }

  // Demais planos (2,3,4,5) → escala completa
  return 'full';
}

// ---------- HTML (sem semanas; lista linear por data) ----------
function htmlTemplate({ events, label, coordinatorName, icons = {}, mode = 'full' }) {

  const blocks = events.map((ev, idx) => {
    const alt = (idx % 2 === 1) ? ' alt' : '';
    const members = sortMembersFixed(ev.scale?.members || []);

        const membersHtml = members.length
      ? members.map(m => {
          const roleName = safe(m.function?.name);
          const iconKey = normalizeKey(roleName);
          const roleImg = icons[iconKey];
          const roleIconHtml = roleImg
            ? `<img class="role-icon" src="${roleImg}" />`
            : functionIconSvg(roleName);
          const userName = safe(m.user?.name);
          const avatar = safe(
            m.user?.photoUrl ||
            m.user?.avatarUrl ||
            m.user?.avatar ||
            (m.user?.image && m.user?.image.url)
          ); // pequeno fallback p/ garantir avatar

          // 🔀 Modo simples: só nome + função (sem ícone, sem avatar)
          const roleCell = mode === 'simple'
            ? `<div class="role"><span>${roleName}</span></div>`
            : `<div class="role">${roleIconHtml}<span>${roleName}</span></div>`;

          const memberCell = mode === 'simple'
            ? `<div class="member"><span>${userName}</span></div>`
            : `<div class="member">
                ${avatar ? `<img class="avatar" src="${avatar}" />` : ''}
                <span>${userName}</span>
              </div>`;

          return `
            <div class="row">
              ${roleCell}
              ${memberCell}
            </div>
          `;
        }).join('')
      : `<div class="row muted"><div>Sem membros escalados.</div></div>`;

    // 🔁 Título invertido: DATA — NOME DO EVENTO
    return `
      <div class="event-card${alt}">
        <div class="event-header">
          <div class="event-title">
            <span class="badge">${fmtDate(ev.date)}</span>
            <span>— ${safe(ev.title) || 'Evento'}</span>
          </div>
          <div class="event-info">
            ${SVG_ICONS.location}
            <span>${ev.location ? safe(ev.location) : 'Local não informado'}</span>
          </div>
        </div>
        <div class="event-body">
          ${membersHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-br">
      <head>
        <meta charset="utf-8" />
        <style>${style()}</style>
        <title>Escalas — ${label}</title>
      </head>
      <body>
        <div class="header">
          <div class="title">Escalas — WorshipHub</div>
          <div class="period">
            Período: <strong>${label}</strong>${coordinatorName ? `<br/>Coord.: ${safe(coordinatorName)}` : ''}
          </div>
        </div>

        ${blocks || '<p class="muted">Sem eventos neste período.</p>'}

        <div class="footer">
          WorshipHub • Relatório premium de escalas
        </div>
      </body>
    </html>
  `;
}

exports.exportScalesPDF = async (req, res) => {
  try {
    // 🔑 entitlements da organização atual (planos / trial)
    const org = req._org || {};
    const ent = req.entitlements || getEntitlementsFor(org);
    req.entitlements = ent; // mantém disponível adiante
    const exportMode = resolveExportMode(ent);

    // 🔧 aceitar datas via body (POST) ou query (GET)
    const source = (req.body && (req.body.start || req.body.period || req.body.ref)) ? req.body : req.query;
    const { start, end, label } = resolveDateRange(source);

    // 🔒 Segurança: export SEMPRE é por organização ativa
    if (!req.orgId) {
      return res.status(400).json({ message: 'Organização ativa não identificada.' });
    }

    // 1) Buscar eventos do período (projeção mínima; sem populate pesado aqui)
const events = await Event.find(
  { org: req.orgId, date: { $gte: start, $lte: end } },
  { title: 1, date: 1, location: 1, scale: 1 } // projeção mínima
)
  .sort({ date: 1 })
  .lean();

// Mapear ids de eventos e ids de escalas já referenciadas
const eventIds = events.map(e => String(e._id));
const scaleIds = events
  .map(e => e.scale)
  .filter(Boolean)
  .map(s => String(s));

// 2) Buscar TODAS as escalas relevantes em uma passada
//    - por referência direta (campo eventId)
//    - e por _id, caso o Event já aponte para Scale

const scales = await Scale.find(
  {
    org: req.orgId,
    $or: [
      { eventId: { $in: eventIds } },
      { _id: { $in: scaleIds } }
    ]
  },
  { eventId: 1, members: 1 } // projeção mínima
)
  .populate('members.user', 'name email photoUrl')
  .populate('members.function', 'name')
  .lean();

// 3) Indexar escalas por eventId e por _id (cobre os dois modelos usados no app)
const scaleByEventId = new Map();
const scaleById      = new Map();
for (const s of scales) {
  if (s?.eventId) scaleByEventId.set(String(s.eventId), s);
  scaleById.set(String(s._id), s);
}

// 4) Montar lista final de eventos com suas escalas, sem N+1
const finalEvents = events.map(ev => {
  // prioridade: se Event.scale aponta direto para uma Scale
  const byRef = ev.scale ? scaleById.get(String(ev.scale)) : null;
  // fallback: procurar pela chave eventId (modelo legado)
  const byEvent = scaleByEventId.get(String(ev._id));
  const scaleData = byRef || byEvent || { members: [] };
  return { ...ev, scale: scaleData };
});


    // 🔧 NOVO: ícones vindos do frontend (data URI por chave normalizada)
    const icons = (req.body && req.body.icons) ? req.body.icons : {};

        // 3) Montar HTML (simples ou completo, conforme plano) — passando icons e mode
    const html = htmlTemplate({
      events: finalEvents,
      label,
      coordinatorName: req.user?.name || '',
      icons,
      mode: exportMode
    });

    // 4) Gerar PDF via Puppeteer (ajustes p/ evitar timeout e manter avatares)
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote'
      ],
      headless: 'new'
    });

    try {
      const page = await browser.newPage();

      // timeouts mais folgados
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(120000);

      // bloquear apenas recursos desnecessários (fonts/analytics); **NÃO** bloquear imagens
      await page.setRequestInterception(true);
      page.on('request', (reqIntercept) => {
        const url = reqIntercept.url();
        if (
          url.includes('fonts.googleapis.com') ||
          url.includes('fonts.gstatic.com') ||
          url.includes('googletagmanager') ||
          url.includes('google-analytics') ||
          url.startsWith('chrome-extension://')
        ) {
          return reqIntercept.abort();
        }
        return reqIntercept.continue();
      });

      // carregamento resiliente (não espera rede ociosa por “eternidade”)
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
      if (page.waitForNetworkIdle) {
        await page.waitForNetworkIdle({ idleTime: 1500, timeout: 8000 }).catch(() => {});
      } else {
        await page.waitForTimeout(800);
      }
      await page.emulateMediaType('screen');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', right: '12mm', bottom: '18mm', left: '12mm' }
      });

      const fn = `escala_${moment(start).format('YYYY-MM-DD')}_${moment(end).format('YYYY-MM-DD')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[exportScalesPDF] Erro:', err?.stack || err?.message || err);
    return res.status(500).json({ message: 'Não foi possível gerar o PDF de escalas.' });
  }
};
