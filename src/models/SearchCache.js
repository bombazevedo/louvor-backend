// src/models/SearchCache.js

const mongoose = require("mongoose");

const searchCacheSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    unique: true
  },
  results: [
    {
      name: String,
      artist: String,
      url: String,
      platform: String,
      thumbnail: String,
      duration: Number,
      bpm: Number,
      key: String,
      album: String,
      channel: String,
      views: Number
    }
  ],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("SearchCache", searchCacheSchema);
