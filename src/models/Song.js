// src/models/Song.js
const mongoose = require('mongoose');

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  youtubeUrl: { type: String },
  spotifyUrl: { type: String },
  deezerUrl: { type: String },
spotifyTrackId: { type: String },
deezerTrackId: { type: String },
youtubeVideoId: { type: String },
normalizedTitle: { type: String, index: true },
normalizedArtist: { type: String, index: true },
isrc: { type: String },
releaseYear: { type: Number },
recordingType: { type: String, enum: ['studio', 'live', 'acoustic', 'remaster', null], default: null },
versionTags: [{ type: String }],

  key: { type: String },
  lyrics: { type: String },
  coverUrl: { type: String },   
album: { type: String },
  bpm: { type: Number },        // 🔹 Adicionado: BPM da música (opcional)
  duration: { type: Number }    // 🔹 Adicionado: Duração em segundos (opcional)
});

module.exports = mongoose.model('Song', SongSchema);
