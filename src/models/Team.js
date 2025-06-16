const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamMemberSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bandRole: {
    type: Schema.Types.ObjectId,
    ref: 'BandRole',
    required: true
  }
}, { _id: false });

const TeamSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  members: [TeamMemberSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Team', TeamSchema);
