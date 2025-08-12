// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const moment = require('moment');
const puppeteer = require('puppeteer');

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
          { path: 'members.user', select: 'name email' },
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

// ======================= Exportar PDF =======================
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

    const membersHtml = members.map(m => `
      <div class="member-row">
        <div class="member-role">🎵 ${safe(m.function?.name)}</div>
        <div class="member-user">${safe(m.user?.name)}</div>
      </div>
    `).join('');

    return `
      <div class="event">
        <div class="event-title">${safe(ev.title)} <span class="badge">${safe(ev.type || 'evento')}</span></div>
        <div class="event-meta">📅 ${fmt(ev.date)} ${ev.location ? ` • 📍 ${safe(ev.location)}` : ''}</div>
        <div class="members">${membersHtml}</div>
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
          <div>
            <div class="title">Escalas — WorshipHub</div>
            <div class="period">${label}</div>
          </div>
          <div style="font-size:12px;text-align:right;">
            Gerado em ${moment().format('DD/MM/YYYY HH:mm')}<br/>
            ${coordinatorName ? `Coord.: ${coordinatorName}` : ''}
          </div>
        </div>
        ${blocks || '<p style="margin-top:16px;opacity:.8">Sem eventos neste período.</p>'}
        <div class="footer">Relatório gerado automaticamente — WorshipHub</div>
      </body>
    </html>
  `;
}

exports.exportScalesPDF = async (req, res) => {
  try {
    const { start, end, label } = resolveDateRange(req.query);

    const events = await Event.find({
      date: { $gte: start, $lte: end }
    })
      .sort({ date: 1 })
      .populate({
        path: 'scale',
        populate: [
          { path: 'members.user', select: 'name email' },
          { path: 'members.function', select: 'name' }
        ]
      });

    // 🔍 Reforço na busca de membros e filtro de eventos sem escala
    const finalEvents = [];
    for (const event of events) {
      let scaleData = event.scale;

      if (!scaleData || !scaleData.members || scaleData.members.length === 0) {
        const foundScale = await Scale.findOne({ eventId: event._id })
          .populate('members.user', 'name email')
          .populate('members.function', 'name');

        if (foundScale && foundScale.members.length > 0) {
          scaleData = foundScale;
        }
      }

      if (!scaleData || !scaleData.members || scaleData.members.length === 0) {
        continue;
      }

      finalEvents.push({
        ...event.toObject(),
        scale: scaleData
      });
    }

    if (finalEvents.length === 0) {
      return res.status(404).json({ message: 'Nenhum evento com membros escalados encontrado no período.' });
    }

    const html = htmlTemplate({
      events: finalEvents,
      label,
      coordinatorName: req.user?.name || ''
    });

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' }
    });
    await browser.close();

    const fn = `escala_${moment(start).format('YYYY-MM-DD')}_${moment(end).format('YYYY-MM-DD')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer, 'binary');
  } catch (err) {
    console.error('[exportScalesPDF] Erro:', err.message);
    res.status(500).json({ message: 'Não foi possível gerar o PDF de escalas.' });
  }
};
