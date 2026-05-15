const mongoose = require('mongoose');
const TestCase = require('../models/TestCase');

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/test-case-management';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  const { host, port, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}:${port}/${name}`);
  await TestCase.syncIndexes();
}

module.exports = { connectDatabase };
