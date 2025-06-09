const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  phone: { type: String },
  birthDate: { type: Date },
  bio: { type: String, maxlength: 1000 },
  photoUrl: { type: String },
  cloudinaryPublicId: { type: String },

  socials: {
    instagram: { type: String },
    facebook: { type: String },
    youtube: { type: String },
    tiktok: { type: String },
  },

  instruments: [String],
  roles: [String],

  role: {
    type: String,
    enum: ['admin', 'coordenador', 'dm', 'usuario'],
    default: 'usuario',
    lowercase: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
