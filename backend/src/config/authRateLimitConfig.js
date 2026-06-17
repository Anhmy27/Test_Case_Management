const LOGIN_RATE_LIMIT_ACTION = 'login';
const REGISTER_SUCCESS_RATE_LIMIT_ACTION = 'register-success';

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

function getLoginIpConfig() {
  return {
    rateLimitAction: LOGIN_RATE_LIMIT_ACTION,
    maxAttempts: readPositiveInt(process.env.AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_IP, 100),
    windowMs: readWindowMs('AUTH_LOGIN_ATTEMPT_LIMIT_WINDOW_MINUTES', 15),
  };
}

function getLoginEmailConfig() {
  return {
    rateLimitAction: LOGIN_RATE_LIMIT_ACTION,
    maxAttempts: readPositiveInt(process.env.AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_EMAIL, 10),
    windowMs: readWindowMs('AUTH_LOGIN_ATTEMPT_LIMIT_WINDOW_MINUTES', 15),
  };
}

function getRegisterSuccessIpConfig() {
  return {
    rateLimitAction: REGISTER_SUCCESS_RATE_LIMIT_ACTION,
    maxSuccesses: readPositiveInt(process.env.AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_IP, 20),
    windowMs: readWindowMs('AUTH_REGISTER_SUCCESS_LIMIT_WINDOW_MINUTES', 60),
  };
}

function getRegisterSuccessEmailConfig() {
  return {
    rateLimitAction: REGISTER_SUCCESS_RATE_LIMIT_ACTION,
    maxSuccesses: readPositiveInt(process.env.AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_EMAIL, 1),
    windowMs: readWindowMs('AUTH_REGISTER_SUCCESS_LIMIT_WINDOW_MINUTES', 60),
  };
}

/** @deprecated use getLoginIpConfig */
function getAuthRateLimitIpConfig(action) {
  if (action === 'login') {
    return getLoginIpConfig();
  }
  if (action === 'register' || action === 'register-success') {
    return getRegisterSuccessIpConfig();
  }
  throw new Error(`Unsupported auth rate-limit action: ${action}`);
}

/** @deprecated use getLoginEmailConfig or getRegisterSuccessEmailConfig */
function getAuthRateLimitEmailConfig(action) {
  if (action === 'login') {
    return getLoginEmailConfig();
  }
  if (action === 'register' || action === 'register-success') {
    return getRegisterSuccessEmailConfig();
  }
  throw new Error(`Unsupported auth rate-limit action: ${action}`);
}

module.exports = {
  LOGIN_RATE_LIMIT_ACTION,
  REGISTER_SUCCESS_RATE_LIMIT_ACTION,
  getAuthRateLimitEmailConfig,
  getAuthRateLimitIpConfig,
  getLoginEmailConfig,
  getLoginIpConfig,
  getRegisterSuccessEmailConfig,
  getRegisterSuccessIpConfig,
};
