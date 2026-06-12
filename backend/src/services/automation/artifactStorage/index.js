const { ARTIFACT_STORAGE_DRIVER } = require('../../../config/automationArtifacts');
const { createLocalArtifactStorage } = require('./localArtifactStorage');
const { createS3ArtifactStorage } = require('./s3ArtifactStorage');

let singletonStorage = null;

const createArtifactStorage = () => {
  const driver = String(ARTIFACT_STORAGE_DRIVER || 'local').trim().toLowerCase();

  if (driver === 's3') {
    return createS3ArtifactStorage();
  }

  if (driver !== 'local') {
    throw new Error(`Unsupported ARTIFACT_STORAGE driver: ${driver}`);
  }

  return createLocalArtifactStorage();
};

const getArtifactStorage = () => {
  if (!singletonStorage) {
    singletonStorage = createArtifactStorage();
  }
  return singletonStorage;
};

const resetArtifactStorageForTests = () => {
  singletonStorage = null;
};

module.exports = {
  createArtifactStorage,
  getArtifactStorage,
  resetArtifactStorageForTests,
};
