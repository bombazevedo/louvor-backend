// src/models/Song.js
const mongoose = require('mongoose');

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  youtubeUrl: { type: String },
  spotifyUrl: { type: String },
  deezerUrl: { type: String },
  key: { type: String },
  lyrics: { type: String }
});

module.exports = mongoose.model('Song', SongSchema);
