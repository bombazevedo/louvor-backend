const mongoose = require('mongoose');
const { Schema } = mongoose;

const LicenseSchema = new Schema({
  status: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
  // 🔑 plano base da organização: FREE | '1' | '2' | '3' | '4' | '5'
  plan: { type: String, default: 'FREE' },
  trialStart: { type: Date, default: Date.now },
  trialEnd:   { type: Date, default: () => new Date(Date.now() + 14*24*60*60*1000) },
  // campos opcionais usados pelo entitlements para ajustes finos
  trialEndsAt: { type: Date },
  overrides: { type: Schema.Types.Mixed, default: null },
  entitlements: { type: Schema.Types.Mixed, default: null }
}, { _id: false });

const InviteSchema = new Schema({
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const OrganizationSchema = new Schema({
  name:  { type: String, required: true, trim: true },
  slug:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  logoUrl: { type: String, default: null },
  cloudinaryPublicId: { type: String, default: null },
  license: { type: LicenseSchema, default: () => ({}) },
  invites: { type: [InviteSchema], default: [] }
}, { timestamps: true });


module.exports = mongoose.model('Organization', OrganizationSchema);
