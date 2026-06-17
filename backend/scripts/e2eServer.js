/**
 * Starts API + in-memory MongoDB for Playwright e2e runs.
 * Seeds a fixed admin account when ADMIN_EMAIL / ADMIN_PASSWORD are set below.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = String(process.env.E2E_PORT || process.env.PORT || 5000);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-jwt-secret-minimum-32-chars!!';
process.env.JIRA_VAULT_SECRET = process.env.JIRA_VAULT_SECRET || 'e2e-jira-vault-secret-long-enough-for-tests';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.ADMIN_NAME = process.env.ADMIN_NAME || 'E2E Admin';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'e2e-admin@test.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'e2e-admin-password-123456';

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

async function start() {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 120000 },
  });
  process.env.MONGO_URI = mongoServer.getUri();

  const { connectDatabase } = require('../src/config/db');
  const { seedAdminIfNeeded } = require('../src/seedAdmin');
  const { seedE2eExecution } = require('./seedE2eExecution');
  const app = require('../src/app');

  await connectDatabase();
  await seedAdminIfNeeded();
  await seedE2eExecution(app);

  const port = Number(process.env.PORT);
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  console.log(`[e2e-server] API ready on http://localhost:${port}`);
}

async function shutdown() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

start().catch(async (error) => {
  console.error('[e2e-server] Failed to start:', error);
  await shutdown();
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await shutdown();
    process.exit(0);
  });
}
