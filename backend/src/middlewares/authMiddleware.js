const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { asyncHandler } = require('../utils/asyncHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-me-secret';

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw httpError(401, 'Missing or invalid authorization token');
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw httpError(401, 'Token is expired or invalid');
  }

  const user = await User.findById(payload.userId).lean();
  if (!user || !user.isActive) {
    throw httpError(401, 'User is not available');
  }

  req.user = {
    id: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
  };

  next();
});

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(httpError(401, 'Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(httpError(403, 'You do not have permission'));
    }

    return next();
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
}

module.exports = { authenticate, authorize, signAccessToken };
