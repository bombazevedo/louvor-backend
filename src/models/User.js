// backend/src/models/User.js
const mongoose = require("mongoose");

const socialSchema = new mongoose.Schema({
  instagram: { type: String, default: '' },
  youtube: { type: String, default: '' },
  tiktok: { type: String, default: '' },
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['membro', 'dm', 'coordenador', 'admin'],
    default: 'membro'
  },
  phone: { type: String },
  birthDate: { type: String },
  avatarUrl: { type: String },
  bio: { type: String },
  social: socialSchema,
  instruments: [String],
  roles: [String],
}, {
  timestamps: true
});

module.exports = mongoose.model("User", UserSchema);
