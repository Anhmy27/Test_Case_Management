const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seedAdminIfNeeded() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existing = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await User.create({
    name: process.env.ADMIN_NAME || 'System Admin',
    email: adminEmail.toLowerCase(),
    passwordHash,
    role: 'admin',
  });

  console.log(`Seeded admin user: ${adminEmail}`);
}

module.exports = { seedAdminIfNeeded };
