// backend/controllers/importController.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Event = require('../models/Event');

exports.importXLS = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });

    const filePath = path.resolve(req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const eventosCriados = [];

    for (let col = 2; col < data[1].length; col++) {
      const dateCell = data[1][col];
      const weekdayCell = data[2]?.[col];
      const minister = data[3]?.[col];

      if (!dateCell) continue;

      let parsedDate;
      if (typeof dateCell === 'number') {
        parsedDate = new Date(Math.round((dateCell - 25569) * 86400 * 1000));
      } else {
        parsedDate = new Date(dateCell);
      }

      if (isNaN(parsedDate.getTime())) {
        console.warn(`⚠️ Data inválida ignorada: ${dateCell}`);
        continue;
      }

      const members = [];
      for (let row = 4; row < data.length; row++) {
        const name = data[row]?.[col];
        if (name) members.push(name);
      }

      const evento = new Event({
        title: `Culto ${weekdayCell || 'sem dia'}`,
        date: parsedDate,
        escala: members,
        minister,
        createdFromImport: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await evento.save();
      eventosCriados.push(evento);
    }

    fs.unlinkSync(filePath);

    res.status(201).json({
      message: 'Importação concluída',
      eventos: eventosCriados
    });
  } catch (error) {
    console.error('❌ Erro na importação XLS:', error);
    res.status(500).json({ message: 'Erro ao processar planilha' });
  }
};
