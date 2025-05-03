// backend/models/Scale.js
const mongoose = require('mongoose');

const ScaleSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  members: [{
    user: { // renomeado de userId para compatibilidade com controller
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    function: {
      type: String,
      required: true,
      enum: [
        'vocal', 'guitarra', 'violão', 'baixo', 'bateria', 'teclado', 'piano',
        'violino', 'flauta', 'saxofone', 'trompete', 'técnico de som', 'projeção', 'outro'
      ]
    },
    confirmed: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Scale = mongoose.model('Scale', ScaleSchema);

module.exports = Scale;
