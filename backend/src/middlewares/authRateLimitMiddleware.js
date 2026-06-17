const { consumeAuthRateLimitsForAuth } = require('../services/authRateLimitService');
const { asyncHandler } = require('../utils/asyncHandler');
const { getClientIp } = require('../utils/clientIp');
const { httpError } = require('../utils/httpError');
const { normalizeAuthEmail } = require('../utils/normalizeAuthEmail');

const ACTION_MESSAGES = {
  login: 'Too many login attempts. Please try again later.',
  register: 'Too many registration attempts. Please try again later.',
};

function createAuthRateLimitMiddleware(action) {
  return asyncHandler(async (req, res, next) => {
    const clientIp = getClientIp(req);
    const email = normalizeAuthEmail(req.body?.email);
    const result = await consumeAuthRateLimitsForAuth({
      action,
      clientIp,
      email,
    });

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfterSeconds));
      throw httpError(429, ACTION_MESSAGES[action] || 'Too many attempts. Please try again later.');
    }

    if (typeof result.remainingIp === 'number') {
      res.set('X-RateLimit-Remaining-Ip', String(result.remainingIp));
    }

    if (typeof result.remainingEmail === 'number') {
      res.set('X-RateLimit-Remaining-Email', String(result.remainingEmail));
    }

    return next();
  });
}

const loginRateLimit = createAuthRateLimitMiddleware('login');
const registerRateLimit = createAuthRateLimitMiddleware('register');

module.exports = {
  createAuthRateLimitMiddleware,
  loginRateLimit,
  registerRateLimit,
};
