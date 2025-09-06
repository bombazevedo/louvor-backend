// models/notification.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    // --- Alvo da notificação ---
    // Importante: usar "user" (não "userId") para alinhar com controllers que fazem find({ user: ... })
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // --- Conteúdo principal (compatível com o seu front) ---
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Tipo lógico para o app.
     * Mantive seus valores e ampliei para cobrir os casos usados no front
     * (repertoire/chatMessage). Não quebra o que já existe.
     */
    type: {
      type: String,
      enum: ['event', 'scale', 'repertoire', 'chatMessage', 'system'],
      default: 'system',
      index: true,
    },

    /**
     * Referência ao item relacionado que o usuário pode abrir ao tocar:
     * - referenceModel: 'Event' | 'Scale' | 'Repertoire' | 'Chat'
     * - reference: ObjectId do documento correspondente
     *
     * Observação: o seu front acessa `relatedModel` — vamos expor `referenceModel`
     * com esse mesmo nome através de `toJSON` (transform) para manter compatível.
     */
    reference: {
      type: Schema.Types.ObjectId,
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      enum: ['Event', 'Scale', 'Repertoire', 'Chat'],
      default: 'Event',
    },

    // --- Estado de leitura/entrega ---
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
    deliveredAt: Date, // quando o push chegou ao device (se controlado)
    sentAt: { type: Date, default: Date.now }, // quando enviamos o push

    // --- Dados auxiliares/fcm/deeplink (opcionais) ---
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deeplink: {
      type: String, // ex: 'louvorapp://event/123'
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    fcmMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    error: {
      type: String, // armazena eventual erro de envio FCM para auditoria
      trim: true,
    },

    // createdAt/updatedAt já são geridos pelo timestamps
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Alinha com o front:
        // - expor "relatedModel" como alias de "referenceModel"
        // - manter _id e também id para conveniência
        // - expor "userId" para o front (mesmo persistindo "user" no banco)
        ret.id = ret._id?.toString?.() || ret._id;
        ret.relatedModel = ret.referenceModel;
        if (ret.user && typeof ret.user === 'object' && ret.user._id) {
          ret.userId = ret.user._id.toString();
        } else {
          ret.userId = ret.user?.toString?.() || ret.user;
        }
        return ret;
      },
    },
  }
);

/** Índices úteis para listagens e filtros */
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

/** Marca leitura automaticamente */
NotificationSchema.pre('save', function markReadAt(next) {
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

/** Helper de instância */
NotificationSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

/**
 * Helper para criar em lote para vários usuários (ex: quando um evento é criado
 * e todos escalados precisam ser notificados).
 *
 * Uso:
 *   Notification.createForUsers(userIds, {
 *     title: 'Novo evento',
 *     message: 'Você foi escalado para o evento X',
 *     type: 'event',
 *     referenceModel: 'Event',
 *     reference: eventId,
 *     deeplink: `louvorapp://event/${eventId}`,
 *     data: { eventId }
 *   })
 */
NotificationSchema.statics.createForUsers = async function (userIds, payload) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const docs = userIds.map((uid) => ({
    ...payload,
    user: uid,
    sentAt: payload?.sentAt || new Date(),
  }));
  return this.insertMany(docs, { ordered: false });
};

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;
