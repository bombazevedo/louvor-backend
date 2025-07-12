// backend/models/SearchHistory.js
const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  term: {
    type: String,
    required: true
  },
  searchedAt: {
    type: Date,
    default: Date.now
  }
});

SearchHistorySchema.index({ userId: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('SearchHistory', SearchHistorySchema);
