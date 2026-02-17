const mongoose = require('mongoose');

const bandRoleSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Unicidade por igreja (não global)
bandRoleSchema.index({ orgId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BandRole', bandRoleSchema);
