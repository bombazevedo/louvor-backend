// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const moment = require('moment');
const puppeteer = require('puppeteer');

// ======================= CRUD Padrão =======================
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find()
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
    const scale = await Scale.findById(req.params.id)
      .populate('members.user', 'name email photoUrl')
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

/** Mapa fixo de ícones por função (nomes exatos + variações comuns) */
const FUNCTION_ICONS = {
  'Ministro': '🎤',
  'Líder de Louvor': '🎤',
  'Vocal': '🎤',
  'Back Vocal': '🎶',
  'Guitarra': '🎸',
  'Guitarrista': '🎸',
  'Violão': '🎸',
  'Baixo': '🪕',
  'Bateria': '🥁',
  'Baterista': '🥁',
  'Teclado': '🎹',
  'Tecladista': '🎹',
  'Percussão': '🪘',
  'Saxofone': '🎷',
  'Trompete': '🎺',
  'Violino': '🎻',
  'Som/Áudio': '🎚️',
  'Áudio': '🎚️',
  'Projeção': '🖥️',
  'Mídia': '🖥️'
};
const DEFAULT_ICON = '🎵';

/** Ordem fixa de funções (as não listadas entram depois, em ordem alfabética) */
const FUNCTION_ORDER = [
  'Ministro',
  'Líder de Louvor',
  'Vocal',
  'Back Vocal',
  'Guitarra',
  'Violão',
  'Baixo',
  'Teclado',
  'Bateria',
  'Percussão',
  'Saxofone',
  'Trompete',
  'Violino',
  'Som/Áudio',
  'Áudio',
  'Projeção',
  'Mídia'
];

/** Resolve o intervalo a partir da query; exibe label com DD/MM/AAAA */
function resolveDateRange(query) {
  if (query.start && query.end) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    end.setHours(23, 59, 59, 999);
    const label = `De ${moment(start).format('DD/MM/YYYY')} a ${moment(end).format('DD/MM/YYYY')}`;
    return { start, end, label };
  }

  const period = String(query.period || 'month').toLowerCase();
  const ref = query.ref ? new Date(query.ref) : new Date();
  const m = moment(ref);

  if (period === 'quarter' || period === 'trimestre') {
    const q = Math.floor(m.month() / 3); // 0..3
    const start = moment(m).month(q * 3).startOf('month').startOf('day').toDate();
    const end = moment(m).month(q * 3 + 2).endOf('month').endOf('day').toDate();
    const label = `Trimestre ${q + 1}/${m.year()}`;
    return { start, end, label };
  }

  if (period === 'semester' || period === 'semestre') {
    const s = m.month() < 6 ? 1 : 2;
    const start = moment(m).month(s === 1 ? 0 : 6).startOf('month').startOf('day').toDate();
    const end = moment(m).month(s === 1 ? 5 : 11).endOf('month').endOf('day').toDate();
    const label = `Semestre ${s}/${m.year()}`;
    return { start, end, label };
  }

  const start = moment(m).startOf('month').startOf('day').toDate();
  const end = moment(m).endOf('month').endOf('day').toDate();
  const label = `${m.format('MMMM [de] YYYY')}`;
  return { start, end, label };
}

/** Estilos premium (WorshipHub) */
function style() {
  const roxo = '#4B0082';
  const dourado = '#FFD700';
  const preto = '#000000';
  const branco = '#FFFFFF';

  return `
    @page { size: A4; margin: 18mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${preto}; }
    .header {
      background: ${roxo};
      color: ${branco};
      padding: 14px 16px;
      border-radius: 12px;
      display:flex;
      align-items:center;
      justify-content:space-between;
    }
    .title {
      font-size: 20px; font-weight: 800; letter-spacing: .3px;
      display:flex; align-items:center; gap:8px;
    }
    .title .dot { width:10px; height:10px; background:${dourado}; border-radius:999px; display:inline-block; }
    .period { font-size: 12px; opacity: .9; text-align:right; }
    .container { margin-top: 12px; }

    .event {
      background: #FFFFFF;
      border: 2px solid ${dourado};
      border-radius: 12px;
      padding: 12px;
      margin: 12px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.08);
    }

    .event-title {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom: 8px;
    }
    .event-name { font-size: 16px; font-weight: 800; color:${roxo}; }
    .badge {
      display:inline-block; padding: 2px 10px; font-size: 11px;
      border:1px solid ${dourado}; border-radius: 999px; color: ${roxo};
      background: #fffbe6; font-weight:700;
    }

    .meta {
      font-size: 13px; margin-bottom: 8px; display:flex; gap:12px; flex-wrap:wrap;
      color:#333;
    }
    .meta .item { display:flex; align-items:center; gap:6px; }
    .meta .icon { color:${dourado}; font-weight:700; }

    .members { border-top: 1px dashed ${dourado}; padding-top: 8px; margin-top: 6px; }
    .member-row {
      display:flex; gap:8px; font-size: 13px; padding:6px 8px; border-radius:8px;
    }
    .member-row.alt { background:#f9f9f9; }
    .member-role { width: 48%; font-weight: 700; color:${roxo}; display:flex; gap:8px; }
    .member-user { width: 52%; }
    .note {
      margin-top: 8px; background: #fffbe6; border:1px solid ${dourado};
      border-radius:8px; padding:8px 10px; font-size:12px; color:#333;
    }
    .footer { margin-top: 14px; font-size: 11px; color: #555; text-align: center; }
  `;
}

/** Ordena os membros pela ordem fixa de função e, depois, por nome */
function sortMembers(members = []) {
  const orderIndex = (fnName = '') => {
    const idx = FUNCTION_ORDER.findIndex(item => item.toLowerCase() === String(fnName).toLowerCase());
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...members].sort((a, b) => {
    const fa = orderIndex(a?.function?.name);
    const fb = orderIndex(b?.function?.name);
    if (fa !== fb) return fa - fb;
    return String(a?.user?.name || '').localeCompare(String(b?.user?.name || ''), 'pt-BR');
  });
}

function htmlTemplate({ events, label, coordinatorName }) {
  const safe = (v) => (v == null ? '' : String(v));
  const fmt = (d) => (d ? moment(d).format('DD/MM/YYYY') : '');

  const blocks = events.map((ev) => {
    const members = sortMembers((ev.scale?.members || []).filter(m => m?.user && m?.function));

    const memberRows = members.length
      ? members.map((m, i) => {
          const fn = safe(m.function?.name);
          const icon = FUNCTION_ICONS[fn] || DEFAULT_ICON;
          const user = safe(m.user?.name);
          const alt = i % 2 === 1 ? ' alt' : '';
          return `
            <div class="member-row${alt}">
              <div class="member-role">${icon} ${fn}</div>
              <div class="member-user">${user}</div>
            </div>
          `;
        }).join('')
      : `<div class="member-row alt"><div class="member-role">—</div><div class="member-user">Sem membros escalados.</div></div>`;

    const tipo = safe(ev.type || 'Evento');
    const local = ev.location ? safe(ev.location) : 'Local não informado';

    return `
      <div class="event">
        <div class="event-title">
          <div class="event-name">${safe(ev.title || 'Evento')}</div>
          <div class="badge">${tipo}</div>
        </div>

        <div class="meta">
          <div class="item"><span class="icon">📅</span> ${fmt(ev.date)}</div>
          <div class="item"><span class="icon">📍</span> ${local}</div>
        </div>

        <div class="members">
          ${memberRows}
        </div>

        ${
          ev.scale?.notes
            ? `<div class="note">📝 ${safe(ev.scale.notes)}</div>`
            : ''
        }
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
          <div class="title"><span class="dot"></span> Escalas — WorshipHub</div>
          <div class="period">
            ${label}<br/>
            ${coordinatorName ? `Coord.: ${coordinatorName}` : ''}
          </div>
        </div>

        <div class="container">
          ${blocks || '<p style="margin-top:16px;opacity:.8">Sem eventos neste período.</p>'}
        </div>

        <div class="footer">
          Gerado automaticamente em ${moment().format('DD/MM/YYYY HH:mm')}
        </div>
      </body>
    </html>
  `;
}

exports.exportScalesPDF = async (req, res) => {
  try {
    const { start, end, label } = resolveDateRange(req.query);

    // Busca eventos no período com escala populada
    const events = await Event.find({
      date: { $gte: start, $lte: end }
    })
      .sort({ date: 1 })
      .populate({
        path: 'scale',
        populate: [
          { path: 'members.user', select: 'name email photoUrl' },
          { path: 'members.function', select: 'name' }
        ]
      })
      .select('title type date location scale')
      .lean();

    // Reforço: se algum evento não trouxe escala via reference, tenta buscar por eventId
    const finalEvents = [];
    for (const ev of events) {
      let scaleData = ev.scale;
      if (!scaleData || !Array.isArray(scaleData.members) || scaleData.members.length === 0) {
        const foundScale = await Scale.findOne({ eventId: ev._id })
          .populate('members.user', 'name email photoUrl')
          .populate('members.function', 'name')
          .lean();
        if (foundScale && Array.isArray(foundScale.members) && foundScale.members.length > 0) {
          scaleData = foundScale;
        }
      }

      // Não exclui eventos vazios: mostramos “Sem membros escalados” para o coordenador ter visão completa
      finalEvents.push({ ...ev, scale: scaleData || { members: [] } });
    }

    const html = htmlTemplate({
      events: finalEvents,
      label,
      coordinatorName: req.user?.name || ''
    });

    // Geração do PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '12mm', bottom: '16mm', left: '12mm' }
    });
    await browser.close();

    const fn = `escala_${moment(start).format('YYYY-MM-DD')}_${moment(end).format('YYYY-MM-DD')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf'); // sem charset
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer, 'binary');
  } catch (err) {
    console.error('[exportScalesPDF] Erro:', err.message);
    res.status(500).json({ message: 'Não foi possível gerar o PDF de escalas.' });
  }
};
