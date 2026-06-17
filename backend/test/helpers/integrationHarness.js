const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { CSRF_COOKIE, CSRF_HEADER } = require('../../src/utils/authCookies');

const TEST_JWT_SECRET = 'integration-test-jwt-secret-min-32-chars!!';
const TEST_JIRA_VAULT_SECRET = 'integration-jira-vault-secret-long-enough-123';

let sharedMongo;
let sharedMongoUri;

function parseSetCookieHeaders(setCookieHeaders = []) {
  const cookies = {};

  for (const header of setCookieHeaders) {
    const [pair] = String(header).split(';');
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}

function formatCookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function ensureTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JIRA_VAULT_SECRET = TEST_JIRA_VAULT_SECRET;
  process.env.CORS_ORIGIN = 'http://localhost:3000';

  if (!sharedMongo) {
    sharedMongo = await MongoMemoryServer.create({
      instance: { launchTimeout: 120000 },
    });
    sharedMongoUri = sharedMongo.getUri();
  }

  process.env.MONGO_URI = sharedMongoUri;
}

async function createIntegrationHarness() {
  await ensureTestEnv();

  if (mongoose.connection.readyState === 0) {
    const { connectDatabase } = require('../../src/config/db');
    await connectDatabase();
  }

  const app = require('../../src/app');

  function createClient() {
    const agent = request.agent(app);
    let cookies = {};

    function mergeResponseCookies(response) {
      cookies = {
        ...cookies,
        ...parseSetCookieHeaders(response.headers['set-cookie']),
      };
    }

    function withAuthHeaders() {
      const headers = {};
      const cookieHeader = formatCookieHeader(cookies);

      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      if (cookies[CSRF_COOKIE]) {
        headers[CSRF_HEADER] = cookies[CSRF_COOKIE];
      }

      return headers;
    }

    return {
      cookies: () => ({ ...cookies }),
      getCsrfToken: () => cookies[CSRF_COOKIE] || '',
      async get(path, expectedStatus) {
        const response = await agent.get(path).set(withAuthHeaders()).expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
      async post(path, body, expectedStatus) {
        let requestBuilder = agent.post(path).set(withAuthHeaders());
        if (body !== undefined) {
          requestBuilder = requestBuilder.send(body);
        }
        const response = await requestBuilder.expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
      async put(path, body, expectedStatus) {
        let requestBuilder = agent.put(path).set(withAuthHeaders());
        if (body !== undefined) {
          requestBuilder = requestBuilder.send(body);
        }
        const response = await requestBuilder.expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
      async patch(path, body, expectedStatus) {
        let requestBuilder = agent.patch(path).set(withAuthHeaders());
        if (body !== undefined) {
          requestBuilder = requestBuilder.send(body);
        }
        const response = await requestBuilder.expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
      async delete(path, expectedStatus) {
        const response = await agent.delete(path).set(withAuthHeaders()).expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
      async postWithHeaders(path, body, headers, expectedStatus) {
        let requestBuilder = agent.post(path).set(headers || {});
        if (body !== undefined) {
          requestBuilder = requestBuilder.send(body);
        }
        const response = await requestBuilder.expect(expectedStatus);
        mergeResponseCookies(response);
        return response;
      },
    };
  }

  return {
    app,
    createClient,
    async clearDatabase() {
      const collections = mongoose.connection.collections;
      await Promise.all(
        Object.values(collections).map((collection) => collection.deleteMany({})),
      );
    },
    async createUser({ name, email, password, role = 'employee' }) {
      const passwordHash = await bcrypt.hash(password, 10);
      const User = require('../../src/models/User');
      return User.create({
        name,
        email: String(email).toLowerCase(),
        passwordHash,
        role,
      });
    },
    async close() {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
      }
    },
  };
}

async function stopSharedMongo() {
  if (sharedMongo) {
    await sharedMongo.stop();
    sharedMongo = null;
    sharedMongoUri = null;
  }
}

module.exports = {
  createIntegrationHarness,
  stopSharedMongo,
  TEST_JWT_SECRET,
  TEST_JIRA_VAULT_SECRET,
};
