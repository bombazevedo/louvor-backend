// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const moment = require('moment');
const puppeteer = require('puppeteer');

moment.locale('pt-br');

// ======================= CRUD Padrão =======================
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find()
      .populate('members.user', 'name email')
      .populate('members.function', 'name');
    res.json(scales);
  } catch (err) {
    console.error('[getAllScales] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escalas' });
  }
};

exports.getScaleById = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id)
      .populate('members.user', 'name email')
      .populate('members.function', 'name');
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada' });
    res.json(scale);
  } catch (err) {
    console.error('[getScaleById] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escala' });
  }
};

exports.getScaleByEventId = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
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

exports.createScale = async (req, res) => {
  try {
    const scale = new Scale({
      eventId: req.body.eventId,
      members: req.body.members || [],
      notes: req.body.notes || ''
    });
    const newScale = await scale.save();

    if (req.body.eventId) {
      await Event.findByIdAndUpdate(req.body.eventId, { scale: newScale._id });
    }

    res.status(201).json(newScale);
  } catch (err) {
    console.error('[createScale] Erro:', err.message);
    res.status(400).json({ message: 'Erro ao criar escala' });
  }
};

exports.updateScale = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id);
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada' });

    if (req.body.members) scale.members = req.body.members;
    if (typeof req.body.notes === 'string') scale.notes = req.body.notes;
    if (req.body.eventId) scale.eventId = req.body.eventId;

    const updated = await scale.save();
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

    await Event.updateMany({ scale: scale._id }, { $unset: { scale: '' } });
    await scale.deleteOne();

    res.json({ message: 'Escala removida com sucesso' });
  } catch (err) {
    console.error('[deleteScale] Erro:', err.message);
    res.status(500).json({ message: 'Erro ao remover escala' });
  }
};

// ======================= Exportar PDF (Premium) =======================

/**
 * Preferência futura: permitir DD/MM/YYYY ou "D de MMMM de YYYY".
 * Por ora, usamos DD/MM/YYYY.
 */
function fmtDate(d) {
  return d ? moment(d).format('DD/MM/YYYY') : '';
}

function resolveDateRange(query) {
  if (query.start && query.end) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: `${fmtDate(start)} - ${fmtDate(end)}` };
  }

  const period = String(query.period || 'month').toLowerCase();
  const ref = query.ref ? new Date(query.ref) : new Date();
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

/**
 * Paleta WorshipHub
 */
const COLORS = {
  roxo: '#4B0082',
  dourado: '#FFD700',
  preto: '#000000',
  branco: '#FFFFFF',
  cinzaClaro: '#F7F7FB',
  cinzaMedio: '#EAEAF2'
};

/**
 * Ordem fixa de funções (nomes EXATOS, como estão salvos no banco).
 * Funções não listadas aqui vão para o final (ordem alfabética).
 */
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

/**
 * Ícones de funções conhecidos (matching por nome exato; fallback 🎵)
 */
const KNOWN_ICONS = {
  'Ministro': '🎤',
  'Voz': '🎤',
  'Back Vocal': '🎤',
  'Guitarra': '🎸',
  'Violão': '🎸',
  'Baixo': '🎸',
  'Teclado': '🎹',
  'Piano': '🎹',
  'Bateria': '🥁',
  'Percussão': '🥁',
  'Sopro': '🎺',
  'Sax': '🎷',
  'Trompete': '🎺',
  'Violino': '🎻',
  'Cello': '🎻',
  'Multimídia': '🖥️',
  'Projeção': '🖥️',
  'Som': '🎚️',
  'Áudio': '🎚️',
  'Luz': '💡',
  'Transmissão': '📡'
};

function getIconForFunctionName(name) {
  if (!name) return '🎵';
  return KNOWN_ICONS[name] || '🎵';
}

/**
 * CSS Premium (cards, cabeçalho, rodapé, alternância de cores, ícones, avatar)
 */
function style() {
  const { roxo, dourado, preto, branco, cinzaClaro, cinzaMedio } = COLORS;

  return `
    @page { size: A4; margin: 18mm 12mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${preto}; }

    .header {
      background: linear-gradient(90deg, ${roxo} 0%, ${preto} 100%);
      color: ${branco}; padding: 16px 18px; border-radius: 12px;
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom: 14px;
    }
    .header .title { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
    .header .period { font-size: 12px; opacity: .95; text-align:right; }
    .header .period strong { color: ${dourado}; }

    .week-title {
      font-size: 14px; font-weight:700; color:${roxo};
      margin: 10px 0 6px 2px;
    }
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
    .event-title { font-size: 16px; font-weight: 800; }
    .event-info { font-size: 12px; opacity: .95; }
    .badge {
      display:inline-block; padding: 2px 8px; font-size: 11px;
      border: 1px solid ${dourado}; border-radius: 999px; color: ${dourado}; background: #1f1033;
      margin-left: 8px;
    }
    .event-body { padding: 10px 12px; }
    .row { display:flex; align-items:center; margin: 6px 0; }
    .role { width: 44%; font-weight:700; font-size: 13px; color:${roxo}; display:flex; align-items:center; }
    .role .icon { margin-right:6px; }
    .member { width: 56%; font-size: 13px; display:flex; align-items:center; }
    .avatar {
      width:18px; height:18px; border-radius: 50%; margin-right: 6px; object-fit: cover; border: 1px solid ${cinzaMedio};
    }

    .footer {
      margin-top: 12px; font-size: 11px; color: #555; text-align: center;
    }
    .muted { opacity:.75; }

    .separator { height:1px; background:${cinzaMedio}; margin: 8px 0 6px 0; }
  `;
}

/**
 * Agrupa eventos por semana (ISO week)
 */
function groupEventsByWeek(events) {
  const groups = {};
  events.forEach(ev => {
    const week = moment(ev.date).isoWeek();
    const year = moment(ev.date).isoWeekYear();
    const key = `${year}-W${week}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });

  // ordenar semanas por data
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    const [ay, aw] = a.split('-W').map(Number);
    const [by, bw] = b.split('-W').map(Number);
    if (ay !== by) return ay - by;
    return aw - bw;
  });

  return orderedKeys.map(key => {
    const [year, wk] = key.split('-W').map(Number);
    const start = moment().isoWeekYear(year).isoWeek(wk).startOf('isoWeek');
    const end = moment().isoWeekYear(year).isoWeek(wk).endOf('isoWeek');
    const label = `Semana ${wk} • ${fmtDate(start)} a ${fmtDate(end)}`;
    const evs = groups[key].sort((a, b) => new Date(a.date) - new Date(b.date));
    return { key, label, events: evs };
  });
}

/**
 * Ordena membros por ordem fixa de função (FIXED_FUNCTION_ORDER) e depois por nome
 */
function sortMembersFixed(members) {
  const orderIndex = new Map(FIXED_FUNCTION_ORDER.map((name, idx) => [name, idx]));
  return [...(members || [])].sort((a, b) => {
    const fa = a?.function?.name || '';
    const fb = b?.function?.name || '';
    const ia = orderIndex.has(fa) ? orderIndex.get(fa) : Number.MAX_SAFE_INTEGER;
    const ib = orderIndex.has(fb) ? orderIndex.get(fb) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    // se mesma função, ordenar por nome do usuário
    const ua = (a?.user?.name || '').localeCompare(b?.user?.name || '');
    return ua;
  });
}

function safe(v) {
  return v == null ? '' : String(v);
}

/**
 * Template premium em HTML (para render no Puppeteer)
 */
function htmlTemplate({ grouped, label, coordinatorName }) {
  const blocks = grouped.map((grp, groupIdx) => {
    const eventCards = grp.events.map((ev, idx) => {
      const alt = (idx % 2 === 1) ? ' alt' : '';
      const members = sortMembersFixed(ev.scale?.members || []);

      const membersHtml = members.length
        ? members.map(m => {
            const roleName = safe(m.function?.name);
            const icon = getIconForFunctionName(roleName);
            const userName = safe(m.user?.name);
            const avatar = safe(m.user?.photoUrl);
            return `
              <div class="row">
                <div class="role"><span class="icon">${icon}</span>${roleName}</div>
                <div class="member">
                  ${avatar ? `<img class="avatar" src="${avatar}" />` : ''}
                  <span>${userName}</span>
                </div>
              </div>
            `;
          }).join('')
        : `<div class="row muted"><div>Sem membros escalados.</div></div>`;

      return `
        <div class="event-card${alt}">
          <div class="event-header">
            <div class="event-title">
              ${safe(ev.title) || 'Evento'}
              <span class="badge">${fmtDate(ev.date)}</span>
            </div>
            <div class="event-info">
              ${ev.location ? `📍 ${safe(ev.location)}` : ''}
            </div>
          </div>
          <div class="event-body">
            ${membersHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="week">
        <div class="week-title">${grp.label}</div>
        ${eventCards}
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
            Período: <strong>${label}</strong><br/>
            ${coordinatorName ? `Coord.: ${safe(coordinatorName)} • ` : ''}Gerado em ${moment().format('DD/MM/YYYY HH:mm')}
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
    const { start, end, label } = resolveDateRange(req.query);

    // 1) Buscar eventos no período com escala e membros populados
    const events = await Event.find({
      date: { $gte: start, $lte: end }
    })
      .sort({ date: 1 })
      .select('title date location scale')
      .populate({
        path: 'scale',
        populate: [
          { path: 'members.user', select: 'name email photoUrl' },
          { path: 'members.function', select: 'name' }
        ]
      })
      .lean();

    // 2) Reforço: se por algum motivo o populate acima não trouxe a escala, tentar pela Scale (legado)
    const finalEvents = [];
    for (const ev of events) {
      let scaleData = ev.scale;
      if (!scaleData || !Array.isArray(scaleData.members)) {
        const foundScale = await Scale.findOne({ eventId: ev._id })
          .populate('members.user', 'name email photoUrl')
          .populate('members.function', 'name')
          .lean();
        if (foundScale) scaleData = foundScale;
      }
      finalEvents.push({ ...ev, scale: scaleData || { members: [] } });
    }

    // 3) Agrupar por semana
    const grouped = groupEventsByWeek(finalEvents);

    // 4) Montar HTML premium
    const html = htmlTemplate({
      grouped,
      label,
      coordinatorName: req.user?.name || ''
    });

    // 5) Gerar PDF via Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      // Permitir carregar avatars externos (Cloudinary etc.)
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', right: '12mm', bottom: '18mm', left: '12mm' }
      });

      const fn = `escala_${moment(start).format('YYYY-MM-DD')}_${moment(end).format('YYYY-MM-DD')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer); // sem 'binary' para evitar charset injection
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[exportScalesPDF] Erro:', err?.stack || err?.message || err);
    return res.status(500).json({ message: 'Não foi possível gerar o PDF de escalas.' });
  }
};
