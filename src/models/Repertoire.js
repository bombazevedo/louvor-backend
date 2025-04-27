const mongoose = require('mongoose');

const RepertoireSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  songs: [{
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    key: {
      type: String,
      trim: true
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

const Repertoire = mongoose.model('Repertoire', RepertoireSchema);

module.exports = Repertoire;
