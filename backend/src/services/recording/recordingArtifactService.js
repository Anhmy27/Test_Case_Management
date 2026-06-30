const fs = require('fs');
const path = require('path');
const { ARTIFACT_ROOT_DIR } = require('../../config/automationArtifacts');
const {
  RECORDING_ARTIFACT_PREFIX,
  RECORDING_STEP_SCREENSHOT_SUBDIR,
  RECORDING_DOM_SNAPSHOT_SUBDIR,
} = require('../../config/recordingConfig');

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/').trim();

const sanitizeSessionId = (sessionId) => {
  const id = String(sessionId || '').trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw new Error('Invalid recording session id');
  }
  return id;
};

const sanitizeFileBase = (fileBase) => {
  const base = String(fileBase || '').trim();
  if (!base || !/^[a-zA-Z0-9._-]+$/.test(base)) {
    throw new Error('Invalid recording artifact file base');
  }
  return base;
};

const sanitizeExtension = (extension, allowed) => {
  const ext = String(extension || '').replace(/^\./, '').toLowerCase();
  if (!allowed.includes(ext)) {
    throw new Error(`Invalid recording artifact extension: ${ext}`);
  }
  return ext;
};

const buildRecordingStepScreenshotKey = (sessionId, fileBase, extension = 'png') => {
  const id = sanitizeSessionId(sessionId);
  const base = sanitizeFileBase(fileBase);
  const ext = sanitizeExtension(extension, ['png', 'jpg', 'jpeg', 'webp']);
  return `${RECORDING_ARTIFACT_PREFIX}/${id}/${RECORDING_STEP_SCREENSHOT_SUBDIR}/${base}.${ext}`;
};

const buildRecordingDomSnapshotKey = (sessionId, fileBase, extension = 'html') => {
  const id = sanitizeSessionId(sessionId);
  const base = sanitizeFileBase(fileBase);
  const ext = sanitizeExtension(extension, ['html', 'htm']);
  return `${RECORDING_ARTIFACT_PREFIX}/${id}/${RECORDING_DOM_SNAPSHOT_SUBDIR}/${base}.${ext}`;
};

const buildRecordingSessionPrefix = (sessionId) => {
  const id = sanitizeSessionId(sessionId);
  return `${RECORDING_ARTIFACT_PREFIX}/${id}/`;
};

const isRecordingArtifactKey = (key) =>
  normalizeSlashes(key).startsWith(`${RECORDING_ARTIFACT_PREFIX}/`);

const recordingContentTypeFromKey = (key) => {
  const normalized = normalizeSlashes(key).toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.html') || normalized.endsWith('.htm')) return 'text/html';
  return 'application/octet-stream';
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveRecordingKeyToAbsolutePath = (rootDir, key) => {
  const normalizedKey = normalizeSlashes(key);
  if (!normalizedKey) {
    throw new Error('Recording artifact key is empty');
  }
  if (!isRecordingArtifactKey(normalizedKey)) {
    throw new Error('Not a recording artifact key');
  }

  const absolutePath = path.join(rootDir, normalizedKey);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(absolutePath);

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Invalid recording artifact key');
  }

  return resolvedPath;
};

const createRecordingArtifactService = ({ rootDir = ARTIFACT_ROOT_DIR } = {}) => {
  ensureDirectory(rootDir);

  return {
    rootDir,

    saveBuffer(key, buffer) {
      const absolutePath = resolveRecordingKeyToAbsolutePath(rootDir, key);
      ensureDirectory(path.dirname(absolutePath));
      fs.writeFileSync(absolutePath, buffer);
      return normalizeSlashes(key);
    },

    saveText(key, text) {
      return this.saveBuffer(key, Buffer.from(String(text ?? ''), 'utf8'));
    },

    exists(key) {
      try {
        const absolutePath = resolveRecordingKeyToAbsolutePath(rootDir, key);
        return fs.existsSync(absolutePath);
      } catch {
        return false;
      }
    },

    resolveReadablePath(key) {
      const absolutePath = resolveRecordingKeyToAbsolutePath(rootDir, key);
      return fs.existsSync(absolutePath) ? absolutePath : null;
    },

    readBuffer(key) {
      const absolutePath = this.resolveReadablePath(key);
      if (!absolutePath) {
        throw new Error('Recording artifact file is missing');
      }
      return fs.readFileSync(absolutePath);
    },

    getContentType(key) {
      return recordingContentTypeFromKey(key);
    },

    deleteSessionArtifacts(sessionId) {
      const prefix = buildRecordingSessionPrefix(sessionId);
      const sessionDir = resolveRecordingKeyToAbsolutePath(
        rootDir,
        `${prefix.slice(0, -1)}`,
      );
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    },
  };
};

let singletonService = null;

const getRecordingArtifactService = () => {
  if (!singletonService) {
    singletonService = createRecordingArtifactService();
  }
  return singletonService;
};

const resetRecordingArtifactServiceForTests = () => {
  singletonService = null;
};

module.exports = {
  buildRecordingStepScreenshotKey,
  buildRecordingDomSnapshotKey,
  buildRecordingSessionPrefix,
  isRecordingArtifactKey,
  recordingContentTypeFromKey,
  createRecordingArtifactService,
  getRecordingArtifactService,
  resetRecordingArtifactServiceForTests,
};
