const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrgMemberSchema = new Schema({
  org:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User',         required: true, index: true },
  role: { type: String, enum: ['coordenador','dm','usuario'], default: 'usuario' },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

OrgMemberSchema.index({ org: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('OrgMember', OrgMemberSchema);
