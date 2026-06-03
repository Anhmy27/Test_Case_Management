const fs = require('fs');
const path = require('path');
const {
  ARTIFACT_ROOT_DIR,
  FAILURE_SCREENSHOT_FILENAME,
} = require('../../config/automationArtifacts');

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const buildResultDirectory = ({ artifactRootDir = ARTIFACT_ROOT_DIR, runId, resultId }) =>
  path.join(artifactRootDir, String(runId), String(resultId));

const createArtifactStore = ({ artifactRootDir = ARTIFACT_ROOT_DIR } = {}) => {
  ensureDirectory(artifactRootDir);

  return {
    getFailureScreenshotAbsolutePath({ runId, resultId }) {
      return path.join(
        buildResultDirectory({ artifactRootDir, runId, resultId }),
        FAILURE_SCREENSHOT_FILENAME,
      );
    },

    ensureResultDirectory({ runId, resultId }) {
      const directory = buildResultDirectory({ artifactRootDir, runId, resultId });
      ensureDirectory(directory);
      return directory;
    },

    toRelativePath(absolutePath) {
      return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    },

    resolveAbsolutePath(relativePath) {
      const normalized = String(relativePath || '').replace(/\\/g, '/').trim();
      if (!normalized) {
        throw new Error('Artifact path is empty');
      }

      const absolutePath = path.resolve(process.cwd(), normalized);
      const resolvedRoot = path.resolve(artifactRootDir);

      if (!absolutePath.startsWith(resolvedRoot)) {
        throw new Error('Invalid artifact path');
      }

      return absolutePath;
    },
  };
};

module.exports = {
  createArtifactStore,
};
