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

  notificationPrefs: {
    pushEnabled: { type: Boolean, default: true },
    channels: {
      scale:         { push: { type: Boolean, default: true } },
      eventReminder: { push: { type: Boolean, default: true }, beforeDays: { type: Number, default: 1 }, beforeHours: { type: Number, default: 1 } },
      repertoire:    { push: { type: Boolean, default: true } },
      broadcast:     { push: { type: Boolean, default: true } },
      chat:          { push: { type: Boolean, default: true } },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start:   { type: String,  default: '22:00' }, // HH:mm
      end:     { type: String,  default: '07:00' }, // HH:mm
      timezone:{ type: String,  default: 'America/Sao_Paulo' },
      allowUrgent: { type: Boolean, default: true }
    }
  },

  role: {
    type: String,
    enum: ['admin', 'coordenador', 'dm', 'usuario'],
    default: 'usuario',
    lowercase: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
