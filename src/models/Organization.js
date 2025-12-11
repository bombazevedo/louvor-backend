const mongoose = require('mongoose');
const { Schema } = mongoose;

const LicenseSchema = new Schema({
  status: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
  // 🔑 plano base da organização: FREE | '1' | '2' | '3' | '4' | '5'
  plan: { type: String, default: 'FREE' },

  // 🔹 Período de teste (trial) controlado pelo backend
  trialStart: { type: Date, default: Date.now },
  trialEnd:   { type: Date, default: () => new Date(Date.now() + 14*24*60*60*1000) },
  // campos opcionais usados pelo entitlements para ajustes finos
  trialEndsAt: { type: Date },

  // 🔹 Assinatura paga (mensal, trimestral, anual, etc.)
  //    Estes campos serão preenchidos/atualizados pelos webhooks do provedor de pagamento.
  billingPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: null, // null = ainda não contratado / não controlado
  },
  // Quando o ciclo de assinatura atual começou (ex.: 01/01/2026)
  planStart: { type: Date },
  // Quando o ciclo atual termina / expira (ex.: 31/01/2026 ou 31/12/2026)
  // Este campo é o que o app usa para exibir "Válido até DD/MM/AAAA"
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
