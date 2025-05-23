// Scale.js ✅ CORRETO
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  function: {
    type: mongoose.Schema.Types.ObjectId, // ← ESSA LINHA FOI CORRIGIDA
    ref: 'BandRole',
    required: true
  },
  confirmed: {
    type: Boolean,
    default: false
  }
});

const scaleSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  members: [memberSchema],
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Scale', scaleSchema);
