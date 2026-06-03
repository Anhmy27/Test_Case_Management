const fs = require('fs');
const mongoose = require('mongoose');
const TestRun = require('../models/TestRun');
const { createArtifactStore } = require('./automation/artifactStore');
const { FAILURE_SCREENSHOT_CONTENT_TYPE } = require('../config/automationArtifacts');
const { httpError } = require('../utils/httpError');

const artifactStore = createArtifactStore();

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const getRunResultFailureScreenshotService = async (runId, resultId) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId')).lean();
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const result = (testRun.results || []).find((entry) => String(entry._id) === String(resultId));
  if (!result) {
    throw httpError(404, 'Run result not found');
  }

  if (!result.failureScreenshot) {
    throw httpError(404, 'Failure screenshot not found');
  }

  let absolutePath;
  try {
    absolutePath = artifactStore.resolveAbsolutePath(result.failureScreenshot);
  } catch {
    throw httpError(400, 'Failure screenshot path is invalid');
  }

  if (!fs.existsSync(absolutePath)) {
    throw httpError(404, 'Failure screenshot file is missing');
  }

  return {
    absolutePath,
    contentType: FAILURE_SCREENSHOT_CONTENT_TYPE,
  };
};

module.exports = {
  getRunResultFailureScreenshotService,
};
