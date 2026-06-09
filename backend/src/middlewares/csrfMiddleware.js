const { httpError } = require('../utils/httpError');
const { CSRF_COOKIE, CSRF_HEADER } = require('../utils/authCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const shouldSkipCsrf = (req) => {
  if (SAFE_METHODS.has(req.method)) {
    return true;
  }

  const url = String(req.originalUrl || req.url || '');

  if (req.method === 'POST' && (url.startsWith('/api/auth/login') || url.startsWith('/api/auth/register'))) {
    return true;
  }

  if (req.method === 'POST' && /\/api\/test-runs\/[^/]+\/automation-results(?:\?.*)?$/.test(url)) {
    return true;
  }

  return false;
};

const csrfProtection = (req, res, next) => {
  if (shouldSkipCsrf(req)) {
    return next();
  }

  const cookieToken = String(req.cookies?.[CSRF_COOKIE] || '').trim();
  const headerToken = String(req.headers[CSRF_HEADER] || '').trim();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(httpError(403, 'Invalid CSRF token'));
  }

  return next();
};

module.exports = {
  csrfProtection,
};
