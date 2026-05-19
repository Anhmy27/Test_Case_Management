const mongoose = require('mongoose');
const TestCase = require('../models/TestCase');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/test-case-management';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  const { host, port, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}:${port}/${name}`);
  await Project.syncIndexes();
  await Version.syncIndexes();
  await TestCaseGroup.syncIndexes();
  await TestCase.syncIndexes();
  await TestPlan.syncIndexes();
}

module.exports = { connectDatabase };
