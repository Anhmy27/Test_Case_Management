const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, '../src/controllers/authController.js');
const authServicePath = path.resolve(__dirname, '../src/services/authService.js');
const authMiddlewarePath = path.resolve(__dirname, '../src/middlewares/authMiddleware.js');
const authCookiesPath = path.resolve(__dirname, '../src/utils/authCookies.js');

function setMock(modulePath, exportsValue) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function withControllerMocks(mocks, run) {
  const original = {
    controller: require.cache[controllerPath],
    authService: require.cache[authServicePath],
    authMiddleware: require.cache[authMiddlewarePath],
    authCookies: require.cache[authCookiesPath],
  };

  delete require.cache[controllerPath];
  setMock(authServicePath, mocks.authService);
  setMock(authMiddlewarePath, mocks.authMiddleware);
  setMock(authCookiesPath, mocks.authCookies);

  const controller = require(controllerPath);

  return Promise.resolve()
    .then(() => run(controller))
    .finally(() => {
      delete require.cache[controllerPath];
      if (original.controller) require.cache[controllerPath] = original.controller;
      else delete require.cache[controllerPath];

      if (original.authService) require.cache[authServicePath] = original.authService;
      else delete require.cache[authServicePath];

      if (original.authMiddleware) require.cache[authMiddlewarePath] = original.authMiddleware;
      else delete require.cache[authMiddlewarePath];

      if (original.authCookies) require.cache[authCookiesPath] = original.authCookies;
      else delete require.cache[authCookiesPath];
    });
}

function invokeHandler(handler, req, res) {
  return new Promise((resolve, reject) => {
    const markDone = () => {
      if (!res.__done) {
        res.__done = true;
        resolve();
      }
    };

    res.json = ((original) => (...args) => {
      const out = original(...args);
      markDone();
      return out;
    })(res.json || (() => res));

    res.send = ((original) => (...args) => {
      const out = original(...args);
      markDone();
      return out;
    })(res.send || (() => res));

    handler(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }
      markDone();
    });
  });
}

test('register sets cookies and returns user payload without token', async () => {
  let setCookiesArgs = null;
  await withControllerMocks({
    authService: {
      registerService: async () => ({
        user: { _id: 'u1' },
        userPayload: { id: 'u1', role: 'employee' },
      }),
      loginService: async () => {
        throw new Error('unexpected');
      },
      getMeService: async () => null,
    },
    authMiddleware: {
      signAccessToken: () => 'signed-token',
    },
    authCookies: {
      setAuthCookies: (res, token) => {
        setCookiesArgs = { res, token };
      },
      clearAuthCookies: () => {},
    },
  }, async ({ register }) => {
    const req = { body: { email: 'a@b.com' } };
    let statusCode = 0;
    let payload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
        return this;
      },
    };

    await invokeHandler(register, req, res);

    assert.equal(statusCode, 201);
    assert.deepEqual(payload, { user: { id: 'u1', role: 'employee' } });
    assert.equal(setCookiesArgs.token, 'signed-token');
  });
});

test('login sets cookies and returns user payload without token', async () => {
  let setCookiesToken = '';
  await withControllerMocks({
    authService: {
      registerService: async () => {
        throw new Error('unexpected');
      },
      loginService: async () => ({
        user: { _id: 'u2' },
        userPayload: { id: 'u2', role: 'admin' },
      }),
      getMeService: async () => null,
    },
    authMiddleware: {
      signAccessToken: () => 'login-token',
    },
    authCookies: {
      setAuthCookies: (res, token) => {
        setCookiesToken = token;
      },
      clearAuthCookies: () => {},
    },
  }, async ({ login }) => {
    const req = { body: { email: 'x@y.com', password: '123456' } };
    let payload = null;
    const res = {
      json(body) {
        payload = body;
        return this;
      },
    };

    await invokeHandler(login, req, res);

    assert.equal(setCookiesToken, 'login-token');
    assert.deepEqual(payload, { user: { id: 'u2', role: 'admin' } });
    assert.equal('token' in payload, false);
  });
});

test('logout clears cookies and returns 204', async () => {
  let clearCalled = false;
  await withControllerMocks({
    authService: {
      registerService: async () => null,
      loginService: async () => null,
      getMeService: async () => null,
    },
    authMiddleware: {
      signAccessToken: () => 'unused',
    },
    authCookies: {
      setAuthCookies: () => {},
      clearAuthCookies: () => {
        clearCalled = true;
      },
    },
  }, async ({ logout }) => {
    let statusCode = 0;
    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      send() {
        return this;
      },
    };

    await invokeHandler(logout, req, res);

    assert.equal(clearCalled, true);
    assert.equal(statusCode, 204);
  });
});

test('me returns null payload when user missing', async () => {
  await withControllerMocks({
    authService: {
      registerService: async () => null,
      loginService: async () => null,
      getMeService: async () => null,
    },
    authMiddleware: {
      signAccessToken: () => 'unused',
    },
    authCookies: {
      setAuthCookies: () => {},
      clearAuthCookies: () => {},
    },
  }, async ({ me }) => {
    const req = { user: { id: 'missing' } };
    let payload = null;
    const res = {
      json(body) {
        payload = body;
        return this;
      },
    };

    await invokeHandler(me, req, res);
    assert.deepEqual(payload, { user: null });
  });
});

test('auth controller propagates service errors via asyncHandler', async () => {
  await withControllerMocks({
    authService: {
      registerService: async () => {
        throw new Error('service exploded');
      },
      loginService: async () => null,
      getMeService: async () => null,
    },
    authMiddleware: {
      signAccessToken: () => 'unused',
    },
    authCookies: {
      setAuthCookies: () => {},
      clearAuthCookies: () => {},
    },
  }, async ({ register }) => {
    const req = { body: {} };
    const res = {
      status() {
        return this;
      },
      json() {
        return this;
      },
    };

    await assert.rejects(() => invokeHandler(register, req, res), /service exploded/);
  });
});
