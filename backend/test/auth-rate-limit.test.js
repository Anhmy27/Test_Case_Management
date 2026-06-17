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
});

test('register success limits default to 20 accounts per IP and 1 per email', () => {
  const original = require.cache[configPath];
  delete require.cache[configPath];

  const {
    getRegisterSuccessIpConfig,
    getRegisterSuccessEmailConfig,
  } = require(configPath);

  assert.deepEqual(getRegisterSuccessIpConfig(), {
    rateLimitAction: 'register-success',
    maxSuccesses: 20,
    windowMs: 60 * 60 * 1000,
  });
  assert.deepEqual(getRegisterSuccessEmailConfig(), {
    rateLimitAction: 'register-success',
    maxSuccesses: 1,
    windowMs: 60 * 60 * 1000,
  });

  restoreModule(configPath, original);
});

test('consumeLoginRateLimits blocks when IP max reached even if email is fresh', async () => {
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

  const { consumeLoginRateLimits } = require(servicePath);
  const result = await consumeLoginRateLimits({
    clientIp: '198.51.100.4',
    email: 'fresh@example.com',
    now,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.blockedBy, 'ip');
  assert.equal(consumeCalls, 0);

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('assertRegisterCreationAllowed does not consume quota on duplicate-email retries', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  let consumeCalls = 0;

  setMock(modelPath, {
    findOne: async () => null,
    findOneAndUpdate: async () => {
      consumeCalls += 1;
      return null;
    },
  });

  const { assertRegisterCreationAllowed } = require(servicePath);
  const result = await assertRegisterCreationAllowed({
    clientIp: '198.51.100.4',
    email: 'new@example.com',
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingIp, 20);
  assert.equal(consumeCalls, 0);

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('reserveRegisterCreationQuota consumes register-success buckets only on successful path', async () => {
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

  const { reserveRegisterCreationQuota } = require(servicePath);
  const result = await reserveRegisterCreationQuota({
    clientIp: '198.51.100.4',
    email: 'user@example.com',
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingIp, 19);
  assert.equal(result.remainingEmail, 0);
  assert.ok(upsertCalls.some((call) => call.filter.key === 'register-success:ip:198.51.100.4'));
  assert.ok(upsertCalls.some((call) => call.filter.key === 'register-success:email:user@example.com'));

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('releaseRegisterCreationQuota refunds reserved register-success buckets', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  const updates = [];

  setMock(modelPath, {
    findOne: async () => null,
    findOneAndUpdate: async (filter, update) => {
      updates.push({ filter, update });
      return null;
    },
  });

  const { releaseRegisterCreationQuota } = require(servicePath);
  await releaseRegisterCreationQuota({
    clientIp: '198.51.100.4',
    email: 'user@example.com',
  });

  assert.equal(updates.length, 2);
  assert.equal(updates[0].filter.key, 'register-success:ip:198.51.100.4');
  assert.equal(updates[1].filter.key, 'register-success:email:user@example.com');
  assert.equal(updates[0].update.$inc.count, -1);

  restoreModule(modelPath, originalModel);
  delete require.cache[servicePath];
});

test('loginRateLimit returns 429 with Retry-After when blocked', async () => {
  const originalMiddleware = require.cache[middlewarePath];
  const originalService = require.cache[servicePath];
  delete require.cache[middlewarePath];

  setMock(servicePath, {
    consumeLoginRateLimits: async () => ({
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
  assert.equal(headers['Retry-After'], '120');

  restoreModule(servicePath, originalService);
  restoreModule(middlewarePath, originalMiddleware);
});
