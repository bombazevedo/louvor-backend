const mongoose = require('mongoose');
const { Schema } = mongoose;

const LicenseSchema = new Schema({
 status: { type: String, enum: ['trial', 'pending', 'active', 'expired'], default: 'trial' },

 // 🔑 plano base da organização: FREE | '1' | '2' | '3' | '4' | '5'
 plan: { type: String, default: 'FREE' },

billingPeriod: {

  type: String,
  // ✅ compatível com o padrão real do fluxo (billing/webhook) + compatível com legado
  enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'monthly', 'quarterly', 'annual'],
  default: null, // null = ainda não contratado / não controlado
},

// ✅ rastreio do provedor (webhook)
pagarmeCustomerId: { type: String, default: null },
pagarmeSubscriptionId: { type: String, default: null },

// Quando o ciclo de assinatura atual começou (ex.: 01/01/2026)
planStart: { type: Date },
// Quando o ciclo atual termina / expira (ex.: 31/01/2026 ou 31/12/2026)
planEnd: { type: Date },

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
