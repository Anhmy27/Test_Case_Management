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

const registerService = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw httpError(400, 'name, email and password are required');
  }

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
    role: 'employee',
  });

  return { user, userPayload: toPublicUser(user) };
};

const loginService = async ({ email, password }) => {
  if (!email || !password) {
    throw httpError(400, 'email and password are required');
  }

  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.isActive) {
    throw httpError(401, 'Invalid email or password');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordCorrect) {
    throw httpError(401, 'Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return { user, userPayload: toPublicUser(user) };
};

const getMeService = async (userId) => {
  return User.findById(userId).select('-passwordHash').lean();
};

module.exports = {
  registerService,
  loginService,
  getMeService,
};
