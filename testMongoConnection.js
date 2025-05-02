// File: testMongoConnection.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas successfully!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB Atlas:', error.message);
  }
}

testConnection();
