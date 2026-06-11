const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { upsertUserJiraAccount } = require('./services/jiraAccountService');

async function seedAdminIfNeeded() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existing = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existing) {
    console.log(
      `Admin user ${adminEmail.toLowerCase()} already exists; not modifying existing credentials.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await User.create({
    name: process.env.ADMIN_NAME || 'System Admin',
    email: adminEmail.toLowerCase(),
    passwordHash,
    role: 'admin',
  });

  const jiraUsername = String(process.env.JIRA_USERNAME || '').trim();
  const jiraPassword = String(process.env.JIRA_PASSWORD || '').trim();
  if (jiraUsername || jiraPassword) {
    await upsertUserJiraAccount({
      userId: adminUser._id,
      jiraUsername,
      jiraPassword,
    });
    console.log(`Seeded Jira profile for admin user: ${adminEmail.toLowerCase()}`);
  }

  console.log(`Seeded admin user: ${adminEmail}`);
}

module.exports = { seedAdminIfNeeded };
