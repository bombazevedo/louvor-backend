const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['ensaio', 'culto', 'outro'],
    default: 'culto'
  },
  status: {
    type: String,
    enum: ['agendado', 'realizado', 'cancelado'],
    default: 'agendado'
  },
  musicLinks: [
    {
      song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
      },
      name: String,
      artist: String,
      platform: String,
      url: String,
      thumbnail: String
    }
  ],
  attachments: [
    {
      name: String,
      url: String,
      publicId: String
    }
  ],
  scale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scale'
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
