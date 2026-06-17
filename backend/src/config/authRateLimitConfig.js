const AUTH_RATE_LIMIT_ACTIONS = ['login', 'register'];

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readWindowMs(envName, fallbackMinutes) {
  return readPositiveInt(process.env[envName], fallbackMinutes) * 60 * 1000;
}

function getAuthRateLimitIpConfig(action) {
  if (action === 'login') {
    return {
      maxAttempts: readPositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 100),
      windowMs: readWindowMs('AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15),
    };
  }

  if (action === 'register') {
    return {
      maxAttempts: readPositiveInt(process.env.AUTH_REGISTER_RATE_LIMIT_MAX, 100),
      windowMs: readWindowMs('AUTH_REGISTER_RATE_LIMIT_WINDOW_MINUTES', 60),
    };
  }

  throw new Error(`Unsupported auth rate-limit action: ${action}`);
}

function getAuthRateLimitEmailConfig(action) {
  if (action === 'login') {
    return {
      maxAttempts: readPositiveInt(process.env.AUTH_LOGIN_EMAIL_RATE_LIMIT_MAX, 10),
      windowMs: readWindowMs('AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15),
    };
  }

  if (action === 'register') {
    return {
      maxAttempts: readPositiveInt(process.env.AUTH_REGISTER_EMAIL_RATE_LIMIT_MAX, 10),
      windowMs: readWindowMs('AUTH_REGISTER_RATE_LIMIT_WINDOW_MINUTES', 60),
    };
  }

  throw new Error(`Unsupported auth rate-limit action: ${action}`);
}

/** @deprecated use getAuthRateLimitIpConfig */
function getAuthRateLimitConfig(action) {
  return getAuthRateLimitIpConfig(action);
}

module.exports = {
  AUTH_RATE_LIMIT_ACTIONS,
  getAuthRateLimitConfig,
  getAuthRateLimitEmailConfig,
  getAuthRateLimitIpConfig,
};
