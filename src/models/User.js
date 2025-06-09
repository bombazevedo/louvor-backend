const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: {
      type: String,
      required: true,
      unique: true, // 🔐 Corrigido conforme solicitado
    },
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

    role: {
      type: String,
      enum: ["coordinator", "dm", "member"],
      default: "member",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
