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
    const rawData = xlsx.utils.sheet_to_json(sheet);

    const groupedEvents = {};

    rawData.forEach((row) => {
      const { nome, email, funcao, data, evento } = row;
      if (!nome || !funcao || !data) return;

      const eventKey = `${evento}-${data}`;
      if (!groupedEvents[eventKey]) {
        groupedEvents[eventKey] = {
          title: evento || `Culto ${data}`,
          date: new Date(data),
          type: 'culto',
          status: 'agendado',
          minister: '',
          escala: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      groupedEvents[eventKey].escala.push(nome);
    });

    const eventosCriados = [];

    for (const key in groupedEvents) {
      const event = new Event(groupedEvents[key]);
      await event.save();
      eventosCriados.push(event);
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
