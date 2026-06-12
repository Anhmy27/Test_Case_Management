const fs = require('fs');
const path = require('path');
const {
  ARTIFACT_ROOT_DIR,
} = require('../../../config/automationArtifacts');
const {
  buildRunFailureScreenshotKey,
  buildDryRunFailureScreenshotKey,
  normalizeStoredArtifactKey,
  resolveLegacyLocalPaths,
  contentTypeFromKey,
} = require('../artifactKeys');

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/').trim();

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveKeyToAbsolutePath = (rootDir, key) => {
  const normalizedKey = normalizeStoredArtifactKey(key);
  if (!normalizedKey) {
    throw new Error('Artifact key is empty');
  }

  const absolutePath = path.join(rootDir, normalizedKey);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(absolutePath);

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Invalid artifact key');
  }

  return resolvedPath;
};

const createLocalArtifactStorage = ({ rootDir = ARTIFACT_ROOT_DIR } = {}) => {
  ensureDirectory(rootDir);

  return {
    driver: 'local',
    rootDir,

    buildRunFailureScreenshotKey,
    buildDryRunFailureScreenshotKey,
    normalizeStoredKey: normalizeStoredArtifactKey,

    getLocalAbsolutePath(key) {
      return resolveKeyToAbsolutePath(rootDir, key);
    },

    ensureKeyDirectory(key) {
      const absolutePath = resolveKeyToAbsolutePath(rootDir, key);
      ensureDirectory(path.dirname(absolutePath));
      return absolutePath;
    },

    saveBuffer(key, buffer) {
      const absolutePath = resolveKeyToAbsolutePath(rootDir, key);
      ensureDirectory(path.dirname(absolutePath));
      fs.writeFileSync(absolutePath, buffer);
      return normalizeStoredArtifactKey(key);
    },

    exists(storedOrKey) {
      const key = normalizeStoredArtifactKey(storedOrKey);
      if (key) {
        const primaryPath = path.join(rootDir, key);
        if (fs.existsSync(primaryPath)) {
          return true;
        }
      }

      for (const candidate of resolveLegacyLocalPaths(storedOrKey)) {
        if (candidate && fs.existsSync(candidate)) {
          return true;
        }
      }
      return false;
    },

    resolveReadablePath(storedOrKey) {
      const key = normalizeStoredArtifactKey(storedOrKey);
      if (key) {
        const primaryPath = path.join(rootDir, key);
        if (fs.existsSync(primaryPath)) {
          return primaryPath;
        }
      }

      for (const candidate of resolveLegacyLocalPaths(storedOrKey)) {
        if (candidate && fs.existsSync(candidate)) {
          return candidate;
        }
      }
      return null;
    },

    createReadStream(storedOrKey) {
      const absolutePath = this.resolveReadablePath(storedOrKey);
      if (!absolutePath) {
        throw new Error('Artifact file is missing');
      }
      return fs.createReadStream(absolutePath);
    },

    getContentType(storedOrKey) {
      const key = normalizeStoredArtifactKey(storedOrKey) || normalizeSlashes(storedOrKey);
      return contentTypeFromKey(key);
    },
  };
};

module.exports = {
  createLocalArtifactStorage,
};
