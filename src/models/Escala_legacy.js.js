
// models/Escala.js
const mongoose = require('mongoose');

const participanteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  funcao: { type: String, required: true },
});

const diaEscalaSchema = new mongoose.Schema({
  data: { type: Date, required: true },
  participantes: [participanteSchema],
});

module.exports = diaEscalaSchema;
