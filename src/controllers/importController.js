// src/controllers/importController.js
const XLSX = require('xlsx');
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do multer para aceitar apenas Excel
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowed = /xlsx|xls/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb('Apenas arquivos Excel são permitidos');
  }
});

// Função principal de importação
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
      const { title, description, date } = row;
      if (!title || !date) continue;

      const newEvent = new Event({
        title,
        description: description || '',
        date: new Date(date),
      });

      const savedEvent = await newEvent.save();

      const members = [];

      // Caso a planilha contenha membros (usuários)
      if (row.email && row.funcao) {
        const email = row.email.toLowerCase();
        const funcao = row.funcao;

        const user = await User.findOne({ email });
        if (user) {
          members.push({ user: user._id, function: funcao });
        }
      }

      if (members.length > 0) {
        const escala = new Scale({
          eventId: savedEvent._id,
          members
        });
        await escala.save();
      }
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário
    res.status(200).json({ message: 'Importação concluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao importar eventos:', error);
    res.status(500).json({ message: 'Erro ao importar eventos.' });
  }
};

module.exports = {
  importEventsFromExcel,
  uploadExcel: upload.single('file')
};
