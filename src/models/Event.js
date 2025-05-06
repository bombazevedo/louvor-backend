// backend/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  location: String,
  type: {
    type: String,
    enum: ['culto', 'ensaio', 'especial'],
    default: 'culto',
  },
  status: {
    type: String,
    enum: ['agendado', 'cancelado', 'concluido'],
    default: 'agendado',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Event', eventSchema);
