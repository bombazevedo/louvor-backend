// src/models/DeviceToken.js
const mongoose = require('mongoose'); 

const deviceTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    token: { type: String, required: true, index: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 1 usuário pode ter vários devices; garanta consulta rápida por user
// 🔧 AJUSTE CIRÚRGICO: índice composto sem 'unique' para não conflitar com 'token' único
deviceTokenSchema.index({ user: 1, token: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
