const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');

const SALT_ROUNDS = 10;

const toPublicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
});

const listUsersService = async () => {
  return User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
};

const createUserByAdminService = async ({
  name, email, password, role,
}) => {
  if (!name || !email || !password) {
    throw httpError(400, 'name, email and password are required');
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'employee';
  const normalizedEmail = String(email).toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw httpError(409, 'Email is already in use');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
  });

  return toPublicUser(user);
};

const updateUserByAdminService = async (id, {
  name, email, password, role,
}) => {
  const user = await User.findById(id);
  if (!user) {
    throw httpError(404, 'User not found');
  }

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

  if (typeof role === 'string' && role.trim()) {
    user.role = role === 'admin' ? 'admin' : 'employee';
  }

  if (typeof password === 'string' && password.trim()) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  await user.save();
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

  await User.deleteOne({ _id: id });
};

module.exports = {
  listUsersService,
  createUserByAdminService,
  updateUserByAdminService,
  deleteUserByAdminService,
};
