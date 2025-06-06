const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  instruments: [String],
  roles: [String],
  role: {
    type: String,
    enum: ['admin', 'coordenador', 'dm', 'usuario'],
    default: 'usuario',
    lowercase: true, // <-- adiciona normalização automática
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
