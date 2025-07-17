const mongoose = require('mongoose');

const chordSchema = new mongoose.Schema({
  name: { type: String, required: true },
  artist: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  chordsText: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Chord', chordSchema);
