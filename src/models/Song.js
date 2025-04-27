const mongoose = require('mongoose');

const SongSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    required: true,
    trim: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  bpm: {
    type: Number
  },
  timeSignature: {
    type: String,
    default: '4/4'
  },
  lyrics: {
    type: String,
    trim: true
  },
  chords: {
    type: String,
    trim: true
  },
  youtubeUrl: {
    type: String,
    trim: true
  },
  spotifyUrl: {
    type: String,
    trim: true
  },
  cifraClubUrl: {
    type: String,
    trim: true
  },
  audioFile: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
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

const Song = mongoose.model('Song', SongSchema);

module.exports = Song;
