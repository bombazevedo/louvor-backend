// src/controllers/importController.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Event = require('../models/Event');
const User = require('../models/User');
const Scale = require('../models/Scale');

const importXLS = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo não enviado.' });
    }

    const userRole = req.user.role.toLowerCase();
    const createdBy = req.user.id;

    if (userRole !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem importar escalas.' });
    }

    const filePath = path.resolve(req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: 'Planilha vazia.' });
    }

    const { title, date, location, type = 'culto', status = 'agendado', notes = '' } = rows[0];
    if (!title || !date || !location) {
      return res.status(400).json({ message: 'Campos do evento ausentes.' });
    }

    const newEvent = new Event({ title, date, location, type, status, notes, createdBy });
    const savedEvent = await newEvent.save();

    const members = [];

    for (const row of rows.slice(1)) {
      const email = row.email?.toLowerCase();
      const funcao = row.funcao || row.function;

      if (!email || !funcao) continue;

      const user = await User.findOne({ email });
      if (user) {
        members.push({ user: user._id, function: funcao });
      } else {
        console.warn(`Usuário não encontrado para o email: ${email}`);
      }
    }

    if (members.length > 0) {
      const escala = new Scale({ eventId: savedEvent._id, members });
      await escala.save();
    }

    fs.unlinkSync(filePath);

    res.status(201).json({ message: 'Importação concluída com sucesso', eventId: savedEvent._id });
  } catch (error) {
    console.error('Erro ao importar XLS:', error);
    res.status(500).json({ message: 'Erro ao processar planilha' });
  }
};

module.exports = {
  importXLS
};
