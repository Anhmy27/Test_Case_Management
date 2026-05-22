const { createSessionStore } = require('./sessionStore');

const normalizeUserKey = (value, fallback = 'default-user') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const resolveWebKey = ({ webId, baseUrl }) => {
  if (webId) {
    return String(webId).trim();
  }

  const base = String(baseUrl || '').trim();
  if (!base) {
    return 'unknown-web';
  }

  try {
    const url = new URL(base);
    return url.host || url.hostname || base;
  } catch {
    return base;
  }
};

const createAuthManager = ({ sessionStore = createSessionStore() } = {}) => {
  return {
    resolveWebKey,

    resolveUserKey(value) {
      return normalizeUserKey(value);
    },

    async createContext({ browser, baseUrl, webId, userKey }) {
      const webKey = resolveWebKey({ webId, baseUrl });
      const resolvedUserKey = normalizeUserKey(userKey);
      const { storageState } = sessionStore.getStorageState({ webKey, userKey: resolvedUserKey });

      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: storageState || undefined,
      });

      return {
        context,
        webKey,
        userKey: resolvedUserKey,
        reusedSession: Boolean(storageState),
      };
    },

    async persistContext({ context, webKey, userKey }) {
      const storageState = await context.storageState();
      return sessionStore.saveStorageState({ webKey, userKey, storageState });
    },
  };
};

module.exports = {
  createAuthManager,
};
