const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/authRateLimitService.js');
const modelPath = path.resolve(__dirname, '../src/models/AuthRateLimit.js');
const middlewarePath = path.resolve(__dirname, '../src/middlewares/authRateLimitMiddleware.js');
const clientIpPath = path.resolve(__dirname, '../src/utils/clientIp.js');
const configPath = path.resolve(__dirname, '../src/config/authRateLimitConfig.js');
const normalizeEmailPath = path.resolve(__dirname, '../src/utils/normalizeAuthEmail.js');

function setMock(modulePath, exportsValue) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function restoreModule(modulePath, original) {
  if (original) {
    require.cache[modulePath] = original;
    return;
  }
  delete require.cache[modulePath];
}

test('getClientIp prefers first x-forwarded-for hop', () => {
  delete require.cache[clientIpPath];
  const { getClientIp } = require(clientIpPath);

  const ip = getClientIp({
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    ip: '127.0.0.1',
  });

  assert.equal(ip, '203.0.113.10');
});

test('normalizeAuthEmail trims and lowercases valid email', () => {
  delete require.cache[normalizeEmailPath];
  const { normalizeAuthEmail } = require(normalizeEmailPath);

  assert.equal(normalizeAuthEmail('  Admin@Example.COM '), 'admin@example.com');
  assert.equal(normalizeAuthEmail('not-an-email'), '');
  assert.equal(normalizeAuthEmail(''), '');
});

test('getAuthRateLimitIpConfig reads login/register env overrides', () => {
  const original = require.cache[configPath];
  delete require.cache[configPath];

  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '7';
  process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES = '20';
  process.env.AUTH_LOGIN_EMAIL_RATE_LIMIT_MAX = '4';
  process.env.AUTH_REGISTER_RATE_LIMIT_MAX = '3';
  process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MINUTES = '90';
  process.env.AUTH_REGISTER_EMAIL_RATE_LIMIT_MAX = '2';

  const { getAuthRateLimitIpConfig, getAuthRateLimitEmailConfig } = require(configPath);

  assert.deepEqual(getAuthRateLimitIpConfig('login'), {
    maxAttempts: 7,
    windowMs: 20 * 60 * 1000,
  });
  assert.deepEqual(getAuthRateLimitEmailConfig('login'), {
    maxAttempts: 4,
    windowMs: 20 * 60 * 1000,
  });
  assert.deepEqual(getAuthRateLimitIpConfig('register'), {
    maxAttempts: 3,
    windowMs: 90 * 60 * 1000,
  });
  assert.deepEqual(getAuthRateLimitEmailConfig('register'), {
    maxAttempts: 2,
    windowMs: 90 * 60 * 1000,
  });

  delete process.env.AUTH_LOGIN_RATE_LIMIT_MAX;
  delete process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES;
  delete process.env.AUTH_LOGIN_EMAIL_RATE_LIMIT_MAX;
  delete process.env.AUTH_REGISTER_RATE_LIMIT_MAX;
  delete process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MINUTES;
  delete process.env.AUTH_REGISTER_EMAIL_RATE_LIMIT_MAX;
  restoreModule(configPath, original);
});

test('consumeAuthRateLimitBucket increments within active window', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  const now = new Date('2026-06-11T10:00:00.000Z');
  const calls = [];

  setMock(modelPath, {
    findOneAndUpdate: async (filter, update, options) => {
      calls.push({ filter, update, options });
      if (calls.length === 1) {
        return {
          count: 2,
          windowStartedAt: new Date('2026-06-11T09:50:00.000Z'),
        };
      }
      return null;
    },
    findOne: async () => null,
  });

  const { consumeAuthRateLimitBucket } = require(servicePath);
  const result = await consumeAuthRateLimitBucket({
    action: 'login',
    scope: 'ip',
    identifier: '198.51.100.4',
    clientIp: '198.51.100.4',
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filter.key, 'login:ip:198.51.100.4');

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('consumeAuthRateLimitsForAuth blocks when IP max reached even if email is fresh', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  const now = new Date('2026-06-11T10:00:00.000Z');
  const windowStartedAt = new Date('2026-06-11T09:50:00.000Z');
  let consumeCalls = 0;

  setMock(modelPath, {
    findOne: async (filter) => {
      if (filter.key === 'login:ip:198.51.100.4') {
        return { count: 100, windowStartedAt };
      }
      if (filter.key === 'login:email:fresh@example.com') {
        return { count: 0, windowStartedAt };
      }
      return null;
    },
    findOneAndUpdate: async () => {
      consumeCalls += 1;
      return null;
    },
  });

  const { consumeAuthRateLimitsForAuth } = require(servicePath);
  const result = await consumeAuthRateLimitsForAuth({
    action: 'login',
    clientIp: '198.51.100.4',
    email: 'fresh@example.com',
    now,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.blockedBy, 'ip');
  assert.equal(result.retryAfterSeconds, 300);
  assert.equal(consumeCalls, 0);

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('consumeAuthRateLimitsForAuth blocks when email max reached even if IP is fresh', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  const now = new Date('2026-06-11T10:00:00.000Z');
  const windowStartedAt = new Date('2026-06-11T09:50:00.000Z');
  let consumeCalls = 0;

  setMock(modelPath, {
    findOne: async (filter) => {
      if (filter.key === 'login:ip:198.51.100.4') {
        return { count: 1, windowStartedAt };
      }
      if (filter.key === 'login:email:locked@example.com') {
        return { count: 10, windowStartedAt };
      }
      return null;
    },
    findOneAndUpdate: async () => {
      consumeCalls += 1;
      return null;
    },
  });

  const { consumeAuthRateLimitsForAuth } = require(servicePath);
  const result = await consumeAuthRateLimitsForAuth({
    action: 'login',
    clientIp: '198.51.100.4',
    email: 'locked@example.com',
    now,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.blockedBy, 'email');
  assert.equal(consumeCalls, 0);

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('consumeAuthRateLimitsForAuth consumes both IP and email buckets when both are allowed', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  const now = new Date('2026-06-11T10:00:00.000Z');
  const upsertCalls = [];

  setMock(modelPath, {
    findOne: async () => null,
    findOneAndUpdate: async (filter, update, options) => {
      upsertCalls.push({ filter, update, options });
      if (upsertCalls.length <= 2) {
        return null;
      }
      return { count: 1, windowStartedAt: now };
    },
  });

  const { consumeAuthRateLimitsForAuth } = require(servicePath);
  const result = await consumeAuthRateLimitsForAuth({
    action: 'login',
    clientIp: '198.51.100.4',
    email: 'user@example.com',
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingIp, 99);
  assert.equal(result.remainingEmail, 9);
  assert.ok(upsertCalls.some((call) => call.filter.key === 'login:ip:198.51.100.4'));
  assert.ok(upsertCalls.some((call) => call.filter.key === 'login:email:user@example.com'));

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('loginRateLimit returns 429 with Retry-After when blocked', async () => {
  const originalMiddleware = require.cache[middlewarePath];
  const originalService = require.cache[servicePath];
  delete require.cache[middlewarePath];

  setMock(servicePath, {
    consumeAuthRateLimitsForAuth: async () => ({
      allowed: false,
      retryAfterSeconds: 120,
      blockedBy: 'ip',
    }),
  });

  const { loginRateLimit } = require(middlewarePath);

  let capturedError = null;
  const headers = {};
  const res = {
    set(name, value) {
      headers[name] = value;
    },
  };

  await new Promise((resolve) => {
    loginRateLimit(
      {
        headers: {},
        ip: '127.0.0.1',
        body: { email: 'user@example.com', password: 'secret' },
      },
      res,
      (err) => {
        capturedError = err;
        resolve();
      },
    );
  });

  assert.ok(capturedError);
  assert.equal(capturedError.statusCode, 429);
  assert.equal(capturedError.message, 'Too many login attempts. Please try again later.');
  assert.equal(headers['Retry-After'], '120');

  restoreModule(servicePath, originalService);
  restoreModule(middlewarePath, originalMiddleware);
});
