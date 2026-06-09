const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { asyncHandler } = require('../utils/asyncHandler');
const { readAccessTokenFromRequest } = require('../utils/authCookies');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-me-secret';
const AUTOMATION_SECRET_HEADER = 'x-automation-secret';

async function attachUserFromRequest(req) {
  const token = readAccessTokenFromRequest(req);
  if (!token) {
    return null;
  }

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

  return req.user;
}

function readAutomationSecret(req) {
  return String(req.headers[AUTOMATION_SECRET_HEADER] || '').trim();
}

function isValidAutomationSecret(providedSecret) {
  const configuredSecret = String(process.env.AUTOMATION_SECRET || '').trim();
  if (!configuredSecret) {
    return false;
  }

  return providedSecret === configuredSecret;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const user = await attachUserFromRequest(req);
  if (!user) {
    throw httpError(401, 'Missing or invalid authorization token');
  }

  next();
});

/**
 * CI/CD shared secret OR admin JWT for POST /test-runs/:runId/automation-results.
 * Mount before global authenticate on that route only.
 */
const authenticateAutomationIngest = asyncHandler(async (req, res, next) => {
  const secret = readAutomationSecret(req);
  if (isValidAutomationSecret(secret)) {
    req.automationIngest = { source: 'secret' };
    return next();
  }

  const user = await attachUserFromRequest(req);
  if (user) {
    if (user.role !== 'admin') {
      throw httpError(403, 'Not authorized to submit automation results');
    }

    req.automationIngest = { source: 'admin' };
    return next();
  }

  if (!process.env.AUTOMATION_SECRET) {
    throw httpError(503, 'Automation ingest is not configured');
  }

  throw httpError(401, 'Invalid automation secret or authorization token');
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
    },
  );
}

module.exports = {
  authenticate,
  authenticateAutomationIngest,
  authorize,
  signAccessToken,
};
