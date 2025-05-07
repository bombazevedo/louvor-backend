const XLSX = require('xlsx');
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

const importEventsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo Excel não enviado.' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: 'Planilha está vazia.' });
    }

    for (const row of rows) {
      const { title, description, date, email, funcao } = row;
      if (!title || !date) continue;

      const newEvent = new Event({
        title,
        description: description || '',
        date: new Date(date),
      });

      const savedEvent = await newEvent.save();

      if (email && funcao) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          const escala = new Scale({
            eventId: savedEvent._id,
            members: [{ user: user._id, function: funcao }]
          });
          await escala.save();
        }
      }
    }

    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'Importação concluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao importar eventos:', error);
    res.status(500).json({ message: 'Erro ao importar eventos.' });
  }
};

module.exports = { importEventsFromExcel };
