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
  },
  scale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scale'
  },
  musicLinks: [{
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    name: String,
    artist: String,
    platform: String,
    url: String,
    thumbnail: String
  }],
  attachments: [{
    name: String,
    url: String
  }],
  // ✅ correção item 1: adicionar a cor-base escolhida pelo coordenador
  primaryColor: { type: String, default: null },
  colorPalette: {
    type: [String],
    default: []
  },
  // ✅ persistência do modo de exibição da paleta (mono|full)
  paletteMode: {
    type: String,
    enum: ['mono', 'full'],
    default: 'full'
  },
  // ✅ compat: espelha paletteMode para clientes legados que leem showFullPalette
  showFullPalette: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Event', eventSchema);
