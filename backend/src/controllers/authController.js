const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { signAccessToken } = require('../middlewares/authMiddleware');

const SALT_ROUNDS = 10;

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw httpError(400, 'name, email and password are required');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw httpError(409, 'Email is already in use');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'employee',
  });

  const token = signAccessToken(user);

  res.status(201).json({
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw httpError(400, 'email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    throw httpError(401, 'Invalid email or password');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordCorrect) {
    throw httpError(401, 'Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);

  res.json({
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash').lean();
  if (!user) {
    throw httpError(404, 'User not found');
  }

  res.json({ user });
});

module.exports = {
  register,
  login,
  me,
};
