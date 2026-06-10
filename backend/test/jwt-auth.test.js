const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const path = require('node:path');

const jwtConfigPath = path.resolve(__dirname, '../src/config/jwtConfig.js');
const authMiddlewarePath = path.resolve(__dirname, '../src/middlewares/authMiddleware.js');

const STRONG_TEST_SECRET = 'test-secret-minimum-32-characters-long!!';

function clearAuthModuleCache() {
  delete require.cache[jwtConfigPath];
  delete require.cache[authMiddlewarePath];
}

function withEnv(overrides, run) {
  const previous = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    NODE_ENV: process.env.NODE_ENV,
  };

  Object.assign(process.env, overrides);
  clearAuthModuleCache();

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      if (previous.JWT_SECRET === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previous.JWT_SECRET;
      }

      if (previous.JWT_EXPIRES_IN === undefined) {
        delete process.env.JWT_EXPIRES_IN;
      } else {
        process.env.JWT_EXPIRES_IN = previous.JWT_EXPIRES_IN;
      }

      if (previous.NODE_ENV === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previous.NODE_ENV;
      }

      delete require.cache[jwtConfigPath];
      delete require.cache[authMiddlewarePath];
    });
}

test('getJwtSecret fails fast when JWT_SECRET is missing', async () => {
  await withEnv({ JWT_SECRET: '' }, () => {
    const { getJwtSecret } = require('../src/config/jwtConfig');
    assert.throws(
      () => getJwtSecret(),
      /JWT_SECRET is required/,
    );
  });
});

test('getJwtSecret rejects weak secret in production', async () => {
  await withEnv({
    JWT_SECRET: 'super-secret-change-me',
    NODE_ENV: 'production',
  }, () => {
    const { getJwtSecret } = require('../src/config/jwtConfig');
    assert.throws(
      () => getJwtSecret(),
      /too weak for production/,
    );
  });
});

test('getJwtExpiresIn defaults to 8h', async () => {
  await withEnv({
    JWT_SECRET: STRONG_TEST_SECRET,
    JWT_EXPIRES_IN: '',
  }, () => {
    const { getJwtExpiresIn, DEFAULT_JWT_EXPIRES_IN } = require('../src/config/jwtConfig');
    assert.equal(getJwtExpiresIn(), '8h');
    assert.equal(DEFAULT_JWT_EXPIRES_IN, '8h');
  });
});

test('signAccessToken embeds tokenVersion claim', async () => {
  await withEnv({
    JWT_SECRET: STRONG_TEST_SECRET,
    JWT_EXPIRES_IN: '1h',
  }, () => {
    const { signAccessToken } = require('../src/middlewares/authMiddleware');
    const token = signAccessToken({
      _id: '507f1f77bcf86cd799439011',
      role: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      tokenVersion: 3,
    });

    const payload = jwt.verify(token, STRONG_TEST_SECRET);
    assert.equal(payload.tokenVersion, 3);
    assert.equal(payload.userId, '507f1f77bcf86cd799439011');
  });
});

test('attachUserFromRequest rejects revoked tokenVersion', async () => {
  await withEnv({
    JWT_SECRET: STRONG_TEST_SECRET,
    JWT_EXPIRES_IN: '1h',
  }, async () => {
    const userId = '507f1f77bcf86cd799439011';
    const User = require('../src/models/User');
    const { signAccessToken, attachUserFromRequest } = require('../src/middlewares/authMiddleware');
    const token = signAccessToken({
      _id: userId,
      role: 'employee',
      name: 'Employee',
      email: 'employee@example.com',
      tokenVersion: 1,
    });

    const originalFindById = User.findById;
    User.findById = () => ({
      lean: async () => ({
        _id: userId,
        role: 'employee',
        name: 'Employee',
        email: 'employee@example.com',
        isActive: true,
        tokenVersion: 2,
      }),
    });

    try {
      const req = {
        cookies: {
          tcm_access_token: token,
        },
      };

      await assert.rejects(
        () => attachUserFromRequest(req),
        (error) => error.statusCode === 401 && error.message === 'Session has been revoked',
      );
    } finally {
      User.findById = originalFindById;
    }
  });
});
