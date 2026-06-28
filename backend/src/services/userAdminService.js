const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { revokeUserSessions } = require('../utils/authTokens');
const { upsertUserJiraAccount, clearJiraSession } = require('./jiraAccountService');

const SALT_ROUNDS = 10;

const toPublicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
});

const normalizeOptionalBoolean = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'active'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'inactive'].includes(normalized)) {
    return false;
  }
  throw httpError(400, `${fieldName} must be true or false`);
};

const listUsersService = async ({ status, includeInactive } = {}) => {
  const query = {};
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const shouldIncludeInactive = normalizeOptionalBoolean(includeInactive, 'includeInactive');

  if (normalizedStatus === 'active') {
    query.isActive = true;
  } else if (normalizedStatus === 'inactive') {
    query.isActive = false;
  } else if (!normalizedStatus && shouldIncludeInactive !== true) {
    // Default list mode is active-only unless caller explicitly asks otherwise.
    query.isActive = true;
  } else if (normalizedStatus && normalizedStatus !== 'all') {
    throw httpError(400, 'status must be active, inactive or all');
  }

  return User.find(query).select('-passwordHash').sort({ createdAt: -1 }).lean();
};

const createUserByAdminService = async ({
  name, email, password, role, isActive, jiraUsername, jiraPassword,
}) => {
  if (!name || !email || !password) {
    throw httpError(400, 'name, email and password are required');
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'employee';
  const normalizedEmail = String(email).toLowerCase();
  const nextIsActive = normalizeOptionalBoolean(isActive, 'isActive') ?? true;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    if (existingUser.isActive !== false) {
      throw httpError(409, 'Email is already in use');
    }

    existingUser.name = name;
    existingUser.passwordHash = passwordHash;
    existingUser.role = normalizedRole;
    existingUser.isActive = nextIsActive;
    await existingUser.save();
    await revokeUserSessions(existingUser._id);

    await upsertUserJiraAccount({
      userId: existingUser._id,
      jiraUsername,
      jiraPassword,
    }).catch(() => {});

    return toPublicUser(existingUser);
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
    isActive: nextIsActive,
  });

  await upsertUserJiraAccount({
    userId: user._id,
    jiraUsername,
    jiraPassword,
  }).catch(() => {});

  return toPublicUser(user);
};

const updateUserByAdminService = async (id, {
  name, email, password, role, isActive, jiraUsername, jiraPassword,
}) => {
  const user = await User.findById(id);
  if (!user) {
    throw httpError(404, 'User not found');
  }

  const previousRole = user.role;
  const previousIsActive = user.isActive !== false;

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  if (typeof email === 'string' && email.trim()) {
    const nextEmail = email.trim().toLowerCase();
    if (nextEmail !== user.email) {
      const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).lean();
      if (existingUser) {
        throw httpError(409, 'Email is already in use');
      }
      user.email = nextEmail;
    }
  }

  let nextRole = user.role;
  if (typeof role === 'string' && role.trim()) {
    nextRole = role === 'admin' ? 'admin' : 'employee';
    user.role = nextRole;
  }

  const nextIsActive = normalizeOptionalBoolean(isActive, 'isActive');
  if (typeof nextIsActive === 'boolean') {
    user.isActive = nextIsActive;
  }

  const passwordChanged = typeof password === 'string' && Boolean(password.trim());
  if (passwordChanged) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const roleChanged = nextRole !== previousRole;
  const deactivated = typeof nextIsActive === 'boolean'
    && nextIsActive === false
    && previousIsActive;

  await user.save();

  if (passwordChanged || roleChanged || deactivated) {
    await revokeUserSessions(user._id);
  }

  if (typeof jiraUsername === 'string' || typeof jiraPassword === 'string') {
    await upsertUserJiraAccount({
      userId: user._id,
      jiraUsername,
      jiraPassword,
    }).catch(() => {});
  }

  return toPublicUser(user);
};

const deleteUserByAdminService = async (id, actorId) => {
  if (String(actorId) === String(id)) {
    throw httpError(400, 'You cannot delete your own account');
  }

  const user = await User.findById(id);
  if (!user) {
    throw httpError(404, 'User not found');
  }

  user.isActive = false;
  await user.save();
  await revokeUserSessions(user._id);
  await clearJiraSession({ userId: user._id }).catch(() => {});
};

module.exports = {
  listUsersService,
  createUserByAdminService,
  updateUserByAdminService,
  deleteUserByAdminService,
};
