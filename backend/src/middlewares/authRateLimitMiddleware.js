const {
  assertRegisterCreationAllowed,
  consumeLoginRateLimits,
} = require('../services/authRateLimitService');
const { asyncHandler } = require('../utils/asyncHandler');
const { getClientIp } = require('../utils/clientIp');
const { httpError } = require('../utils/httpError');
const { normalizeAuthEmail } = require('../utils/normalizeAuthEmail');

function applyLoginRateLimitHeaders(res, result) {
  if (typeof result.remainingIp === 'number') {
    res.set('X-RateLimit-Remaining-Login-Attempts-Ip', String(result.remainingIp));
  }

  if (typeof result.remainingEmail === 'number') {
    res.set('X-RateLimit-Remaining-Login-Attempts-Email', String(result.remainingEmail));
  }
}

const loginRateLimit = asyncHandler(async (req, res, next) => {
  const clientIp = getClientIp(req);
  const email = normalizeAuthEmail(req.body?.email);
  const result = await consumeLoginRateLimits({ clientIp, email });

  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfterSeconds));
    throw httpError(429, 'Too many login attempts. Please try again later.');
  }

  applyLoginRateLimitHeaders(res, result);
  return next();
});

const registerCreationRateLimitGuard = asyncHandler(async (req, res, next) => {
  const clientIp = getClientIp(req);
  const email = normalizeAuthEmail(req.body?.email);
  const result = await assertRegisterCreationAllowed({ clientIp, email });

  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfterSeconds));
    throw httpError(
      429,
      result.blockedBy === 'email'
        ? 'Too many accounts created for this email. Please try again later.'
        : 'Too many accounts created from this network. Please try again later.',
    );
  }

  res.set('X-RateLimit-Remaining-Registrations-Ip', String(result.remainingIp ?? 0));
  if (typeof result.remainingEmail === 'number') {
    res.set('X-RateLimit-Remaining-Registrations-Email', String(result.remainingEmail));
  }

  return next();
});

module.exports = {
  loginRateLimit,
  registerCreationRateLimitGuard,
  /** @deprecated use registerCreationRateLimitGuard */
  registerRateLimit: registerCreationRateLimitGuard,
};
