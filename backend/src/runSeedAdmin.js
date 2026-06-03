require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase } = require('./config/db');
const { seedAdminIfNeeded } = require('./seedAdmin');

async function run() {
  await connectDatabase();
  await seedAdminIfNeeded();
}

run()
  .then(async () => {
    await mongoose.connection.close();
    console.log('Done seeding admin (if needed).');
  })
  .catch(async (error) => {
    console.error('Failed to seed admin:', error);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  });
