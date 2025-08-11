// src/controllers/scaleController.js
// ⬇️ (mantenha seus requires existentes)
const Event = require('../models/Event');
const moment = require('moment'); // já usado no projeto; se não, remova e use Date puro
const puppeteer = require('puppeteer'); // utiliza dep já existente
const path = require('path');

/**
 * Traduz query em intervalo de datas.
 * Suporta:
 *  - period=month|quarter|semester
 *  - ref=YYYY-MM-DD (opcional; default = hoje)
 *  - OU start=YYYY-MM-DD&end=YYYY-MM-DD (prioritário)
 */
function resolveDateRange(query) {
  if (query.start && query.end) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: `De ${query.start} a ${query.end}` };
  }

  const period = String(query.period || 'month').toLowerCase();
  const ref = query.ref ? new Date(query.ref) : new Date();
  const m = moment(ref);

  if (period === 'quarter' || period === 'trimestre') {
    const q = Math.floor(m.month() / 3); // 0..3
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

  // default: month
  const start = moment(m).startOf('month').startOf('day').toDate();
  const end = moment(m).endOf('month').endOf('day').toDate();
  return { start, end, label: `${m.format('MMMM [de] YYYY')}` };
}

function style() {
  // Identidade Visual WorshipHub
  const roxo = '#4B0082';
  const dourado = '#FFD700';
  const preto = '#000000';
  const branco = '#FFFFFF';

  return `
    @page { size: A4; margin: 20mm 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${preto}; }
    .header {
      background: ${roxo}; color: ${branco}; padding: 14px 16px; border-radius: 10px;
      display:flex; align-items:center; justify-content:space-between;
    }
    .title { font-size: 20px; font-weight: 700; letter-spacing: .3px; }
    .period { font-size: 12px; opacity: .9; }
    .event {
      border: 1px solid ${dourado}; border-radius: 12px; padding: 12px; margin: 12px 0;
    }
    .event-title { font-size: 16px; font-weight: 700; margin: 0 0 6px 0; }
    .event-meta { font-size: 13px; margin: 2px 0; }
    .members { margin-top: 8px; }
    .member-row { display:flex; font-size: 13px; margin: 2px 0; }
    .member-role { width: 45%; font-weight: 600; }
    .member-user { width: 55%; }
    .footer { margin-top: 16px; font-size: 11px; color: #555; text-align: center; }
    .badge {
      display:inline-block; padding: 2px 8px; font-size: 11px; border:1px solid ${dourado};
      border-radius: 999px; color: ${roxo}; margin-left: 8px; background: #fffbe6;
    }
  `;
}

function htmlTemplate({ events, label, coordinatorName }) {
  const safe = (v) => (v == null ? '' : String(v));
  const fmt = (d) => (d ? moment(d).format('DD/MM/YYYY') : '');

  const blocks = events.map((ev) => {
    const members = (ev.scale?.members || []).filter(m => m?.user && m?.function);
    // Ordena por função -> nome do usuário
    members.sort((a, b) => {
      const fa = (a.function?.name || '').localeCompare(b.function?.name || '');
      if (fa !== 0) return fa;
      return (a.user?.name || '').localeCompare(b.user?.name || '');
    });

    const memberRows = members.map((m) => {
      const role = safe(m.function?.name);
      const user = safe(m.user?.name);
      return `
        <div class="member-row">
          <div class="member-role">• ${role}</div>
          <div class="member-user">${user}</div>
        </div>`;
    }).join('');

    return `
      <div class="event">
        <div class="event-title">${safe(ev.title) || 'Evento'} 
          <span class="badge">${fmt(ev.date)}</span>
        </div>
        <div class="event-meta">📍 ${safe(ev.location) || 'Local não informado'}</div>
        <div class="members">${memberRows || '<em>Sem membros escalados.</em>'}</div>
      </div>`;
  }).join('');

  return `
    <html>
      <head><meta charset="utf-8" /><style>${style()}</style></head>
      <body>
        <div class="header">
          <div class="title">Escalas — WorshipHub</div>
          <div class="period">${label}${coordinatorName ? ` • Coord.: ${coordinatorName}` : ''}</div>
        </div>
        ${blocks || '<p style="margin-top:16px;">Nenhum evento encontrado no período selecionado.</p>'}
        <div class="footer">
          Gerado automaticamente pelo WorshipHub em ${moment().format('DD/MM/YYYY HH:mm')}
        </div>
      </body>
    </html>`;
}

/**
 * GET /api/scales/export
 * Query:
 *   - period=month|quarter|semester (default: month)
 *   - ref=YYYY-MM-DD (opcional; base para o período)
 *   - OU start/end (YYYY-MM-DD) para intervalo custom
 * Retorna: application/pdf (attachment)
 */
async function exportScalesPDF(req, res) {
  try {
    const { start, end, label } = resolveDateRange(req.query);

    // Busca eventos no intervalo com escala e membros populados
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
      .select('title date location scale')
      .lean();

    const html = htmlTemplate({
      events,
      label,
      coordinatorName: req.user?.name || ''
    });

    // Renderiza com headless Chromium já disponível via puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '12mm', right: '12mm' }
      });

      const filenameSafe = `escalas_${moment(start).format('YYYYMMDD')}_${moment(end).format('YYYYMMDD')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameSafe}"`);
      return res.status(200).send(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[exportScalesPDF] Erro:', err?.message || err);
    return res.status(500).json({ message: 'Falha ao gerar PDF de escalas.' });
  }
}

// ⬇️ Acrescente este export ao que você já possui
module.exports.exportScalesPDF = exportScalesPDF;
