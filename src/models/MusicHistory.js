const mongoose = require('mongoose');

const musicHistorySchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },
    artista: {
      type: String,
      required: true,
      trim: true
    },
    plataforma: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    eventoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    dataExecucao: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MusicHistory', musicHistorySchema);
