// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const moment = require('moment');
const puppeteer = require('puppeteer');
const path = require('path');

// Listar todas as escalas
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find()
      .populate('members.user', 'name email')
      .populate('members.function', 'name');
    res.json(scales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obter detalhes de uma escala por ID
exports.getScaleById = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id)
      .populate('members.user', 'name email')
      .populate('members.function', 'name');
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    res.json(scale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obter escala associada a um evento
exports.getScaleByEventId = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate({
        path: 'scale',
        populate: [
          { path: 'members.user', select: 'name email' },
          { path: 'members.function', select: 'name' }
        ]
      });
    if (!event || !event.scale) {
      return res.status(404).json({ message: 'Escala não encontrada para este evento' });
    }
    res.json(event.scale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Criar nova escala
exports.createScale = async (req, res) => {
  const scale = new Scale({
    members: req.body.members
  });
  try {
    const newScale = await scale.save();
    res.status(201).json(newScale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Atualizar escala existente
exports.updateScale = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id);
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    scale.members = req.body.members || scale.members;
    const updatedScale = await scale.save();
    res.json(updatedScale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Remover escala
exports.deleteScale = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id);
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    await scale.deleteOne();
    res.json({ message: 'Escala removida com sucesso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======================= Funções auxiliares para exportScalesPDF =======================
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

function style() {
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
    .title { font-size: 20px; font-weight: 700; }
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

async function exportScalesPDF(req, res) {
  try {
    const { start, end, label } = resolveDateRange(req.query);

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

// Exporta tudo junto
module.exports.exportScalesPDF = exportScalesPDF;
