const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['event', 'scale', 'message', 'system'],
    default: 'system'
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Event', 'Scale', 'Chat'],
    default: 'Event'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
