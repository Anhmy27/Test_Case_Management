const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');

const SALT_ROUNDS = 10;

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.json({ users });
});

const createUserByAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw httpError(400, 'name, email and password are required');
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'employee';
  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw httpError(409, 'Email is already in use');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: normalizedRole,
  });

  res.status(201).json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const updateUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

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

  res.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (String(req.user.id) === String(id)) {
    throw httpError(400, 'You cannot delete your own account');
  }

  const user = await User.findById(id);
  if (!user) {
    throw httpError(404, 'User not found');
  }

  await User.deleteOne({ _id: id });

  res.json({ message: 'User deleted' });
});

module.exports = {
  listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
};
