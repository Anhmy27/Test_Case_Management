const crypto = require('crypto');
const { isProduction } = require('../utils/runtimeEnv');

const ACCESS_TOKEN_COOKIE = 'tcm_access_token';
const CSRF_COOKIE = 'tcm_csrf';
const CSRF_HEADER = 'x-csrf-token';

const parseDurationMs = (value, fallbackMs) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallbackMs;
  }

  const match = raw.match(/^(\d+)([smhd])?$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = String(match[2] || 's').toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.s);
};

const cookieBaseOptions = () => ({
  sameSite: 'lax',
  secure: isProduction(),
  path: '/',
});

const getAuthCookieMaxAgeMs = () => parseDurationMs(process.env.JWT_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);

const setAuthCookies = (res, accessToken) => {
  const maxAge = getAuthCookieMaxAgeMs();
  const csrfToken = crypto.randomBytes(32).toString('hex');

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge,
  });

  res.cookie(CSRF_COOKIE, csrfToken, {
    ...cookieBaseOptions(),
    httpOnly: false,
    maxAge,
  });
};

const clearAuthCookies = (res) => {
  const options = cookieBaseOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, options);
};

const readAccessTokenFromRequest = (req) => {
  const cookieToken = String(req.cookies?.[ACCESS_TOKEN_COOKIE] || '').trim();
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
};

module.exports = {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  setAuthCookies,
  clearAuthCookies,
  readAccessTokenFromRequest,
};
