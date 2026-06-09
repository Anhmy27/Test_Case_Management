const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  setAuthCookies,
  clearAuthCookies,
  readAccessTokenFromRequest,
} = require('../src/utils/authCookies');
const { csrfProtection } = require('../src/middlewares/csrfMiddleware');
const { errorMiddleware } = require('../src/middlewares/errorMiddleware');

test('readAccessTokenFromRequest reads cookie token only', () => {
  const req = {
    cookies: {
      [ACCESS_TOKEN_COOKIE]: 'cookie-token-value',
    },
    headers: {
      authorization: 'Bearer legacy-header-token',
    },
  };

  const token = readAccessTokenFromRequest(req);
  assert.equal(token, 'cookie-token-value');
});

test('readAccessTokenFromRequest ignores bearer header when cookie missing', () => {
  const req = {
    cookies: {},
    headers: {
      authorization: 'Bearer should-not-be-used',
    },
  };

  const token = readAccessTokenFromRequest(req);
  assert.equal(token, '');
});

test('setAuthCookies sets access + csrf cookies', () => {
  const calls = [];
  const res = {
    cookie: (...args) => {
      calls.push(args);
    },
  };

  setAuthCookies(res, 'access-token');

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], ACCESS_TOKEN_COOKIE);
  assert.equal(calls[0][1], 'access-token');
  assert.equal(calls[0][2].httpOnly, true);
  assert.equal(calls[1][0], CSRF_COOKIE);
  assert.equal(typeof calls[1][1], 'string');
  assert.equal(calls[1][2].httpOnly, false);
});

test('clearAuthCookies clears both auth cookies', () => {
  const cleared = [];
  const res = {
    clearCookie: (...args) => {
      cleared.push(args);
    },
  };

  clearAuthCookies(res);

  assert.equal(cleared.length, 2);
  assert.equal(cleared[0][0], ACCESS_TOKEN_COOKIE);
  assert.equal(cleared[1][0], CSRF_COOKIE);
});

test('csrfProtection skips safe GET requests', () => {
  const req = {
    method: 'GET',
    originalUrl: '/api/projects',
    cookies: {},
    headers: {},
  };

  let called = false;
  csrfProtection(req, {}, (err) => {
    assert.equal(err, undefined);
    called = true;
  });
  assert.equal(called, true);
});

test('csrfProtection rejects mutating request without matching tokens', () => {
  const req = {
    method: 'POST',
    originalUrl: '/api/projects',
    cookies: {
      [CSRF_COOKIE]: 'cookie-token',
    },
    headers: {
      [CSRF_HEADER]: 'different-header-token',
    },
  };

  let capturedError = null;
  csrfProtection(req, {}, (err) => {
    capturedError = err;
  });

  assert.ok(capturedError);
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.message, 'Invalid CSRF token');
});

test('csrfProtection accepts mutating request with matching tokens', () => {
  const req = {
    method: 'PATCH',
    originalUrl: '/api/test-runs/abc/end',
    cookies: {
      [CSRF_COOKIE]: 'same-token',
    },
    headers: {
      [CSRF_HEADER]: 'same-token',
    },
  };

  let capturedError = null;
  csrfProtection(req, {}, (err) => {
    capturedError = err;
  });

  assert.equal(capturedError, undefined);
});

test('errorMiddleware sanitizes HTML upstream message in production', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const err = new Error('<html><body>upstream stack dump</body></html>');
  err.statusCode = 502;

  let responseStatus = 0;
  let responsePayload = null;
  const res = {
    headersSent: false,
    status(code) {
      responseStatus = code;
      return this;
    },
    json(payload) {
      responsePayload = payload;
      return this;
    },
  };

  errorMiddleware(err, {}, res, () => {});

  assert.equal(responseStatus, 502);
  assert.equal(responsePayload.message, 'Upstream service error');
  assert.equal('stack' in responsePayload, false);

  process.env.NODE_ENV = prevNodeEnv;
});

test('errorMiddleware includes stack outside production', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;

  const err = new Error('debug message');
  err.statusCode = 500;

  let responsePayload = null;
  const res = {
    headersSent: false,
    status() {
      return this;
    },
    json(payload) {
      responsePayload = payload;
      return this;
    },
  };

  errorMiddleware(err, {}, res, () => {});

  assert.equal(responsePayload.message, 'debug message');
  assert.equal(typeof responsePayload.stack, 'string');
  assert.ok(responsePayload.stack.includes('Error: debug message'));

  process.env.NODE_ENV = prevNodeEnv;
});
