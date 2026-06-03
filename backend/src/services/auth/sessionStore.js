const fs = require('fs');
const path = require('path');

const DEFAULT_SESSION_DIR = path.resolve(process.cwd(), '.sessions');

const normalizeKey = (value, fallback = 'default') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }

  return raw.replace(/[^a-zA-Z0-9._-]+/g, '_');
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const buildSessionPath = ({ sessionDir, webKey, userKey }) => {
  const safeWeb = normalizeKey(webKey, 'unknown-web');
  const safeUser = normalizeKey(userKey, 'default-user');

  return path.join(sessionDir, safeWeb, `${safeUser}.json`);
};

const readStorageState = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeStorageState = (filePath, storageState) => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2), 'utf8');
};

const createSessionStore = ({ sessionDir = DEFAULT_SESSION_DIR } = {}) => {
  ensureDirectory(sessionDir);

  return {
    getStorageState({ webKey, userKey }) {
      const filePath = buildSessionPath({ sessionDir, webKey, userKey });
      const storageState = readStorageState(filePath);
      return { storageState, filePath };
    },

    saveStorageState({ webKey, userKey, storageState }) {
      const filePath = buildSessionPath({ sessionDir, webKey, userKey });
      writeStorageState(filePath, storageState);
      return filePath;
    },

    getSessionPath({ webKey, userKey }) {
      return buildSessionPath({ sessionDir, webKey, userKey });
    },
  };
};

module.exports = {
  createSessionStore,
};
