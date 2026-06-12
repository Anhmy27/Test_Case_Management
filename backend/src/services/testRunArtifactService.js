const mongoose = require('mongoose');

const TestRun = require('../models/TestRun');

const { getArtifactStorage } = require('./automation/artifactStorage');

const { extensionFromMime } = require('./automation/artifactKeys');

const { httpError } = require('../utils/httpError');



const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;



const toObjectId = (id, fieldName) => {

  if (!mongoose.Types.ObjectId.isValid(id)) {

    throw httpError(400, `${fieldName} is invalid`);

  }



  return new mongoose.Types.ObjectId(id);

};



const resultHasUserAssignment = (result, userId) => {

  const normalizedUserId = String(userId || '');

  const ownerId = String(result?.owner || '');

  const assigneeIds = Array.isArray(result?.assignees)

    ? result.assignees.map((assignee) => String(assignee || ''))

    : [];

  return ownerId === normalizedUserId || assigneeIds.includes(normalizedUserId);

};



const assertResultScreenshotPermission = (testRun, result, user) => {

  const isAdmin = user.role === 'admin';

  const isStarter = String(testRun.startedBy?._id || testRun.startedBy) === user.id;

  const hasAssignedItem = resultHasUserAssignment(result, user.id);

  if (!isAdmin && !isStarter && !hasAssignedItem) {

    throw httpError(403, 'You do not have permission to modify this screenshot');

  }

};



const getRunResultFailureScreenshotService = async (runId, resultId, user) => {

  const storage = getArtifactStorage();

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))

    .populate('startedBy', '_id')

    .lean();

  if (!testRun) {

    throw httpError(404, 'Test run not found');

  }



  const isAdmin = user.role === 'admin';

  const isStarter = String(testRun.startedBy?._id || testRun.startedBy) === user.id;

  const result = (testRun.results || []).find((entry) => String(entry._id) === String(resultId));

  if (!result) {

    throw httpError(404, 'Run result not found');

  }



  const hasAssignedItem = resultHasUserAssignment(result, user.id);

  if (!isAdmin && !isStarter && !hasAssignedItem) {

    throw httpError(403, 'You do not have permission to view this screenshot');

  }



  if (!result.failureScreenshot) {

    throw httpError(404, 'Failure screenshot not found');

  }



  const contentType = storage.getContentType(result.failureScreenshot);



  if (storage.driver === 's3') {

    const payload = await storage.getReadablePayload(result.failureScreenshot);

    return {

      stream: payload.stream,

      contentType: payload.contentType || contentType,

    };

  }



  const absolutePath = storage.resolveReadablePath(result.failureScreenshot);

  if (!absolutePath) {

    throw httpError(404, 'Failure screenshot file is missing');

  }



  return {

    absolutePath,

    contentType,

  };

};



const uploadRunResultFailureScreenshotService = async (runId, resultId, user, file) => {

  if (!file || !file.buffer?.length) {

    throw httpError(400, 'Screenshot file is required');

  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {

    throw httpError(400, 'Screenshot must be PNG, JPEG, or WebP');

  }

  if (file.size > MAX_UPLOAD_BYTES) {

    throw httpError(400, 'Screenshot must be 5 MB or smaller');

  }



  const storage = getArtifactStorage();

  if (storage.driver !== 'local') {

    throw httpError(501, 'Manual screenshot upload is only supported with local artifact storage for now');

  }



  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));

  if (!testRun) {

    throw httpError(404, 'Test run not found');

  }

  if (!['running', 'completed'].includes(String(testRun.status || ''))) {

    throw httpError(400, 'Screenshots can only be uploaded for active or completed runs');

  }



  const result = (testRun.results || []).find((entry) => String(entry._id) === String(resultId));

  if (!result) {

    throw httpError(404, 'Run result not found');

  }

  if (String(result.status || '') !== 'fail') {

    throw httpError(400, 'Screenshots can only be uploaded for failed results');

  }



  assertResultScreenshotPermission(

    { startedBy: testRun.startedBy },

    result,

    user,

  );



  const extension = extensionFromMime(file.mimetype);

  const storageKey = storage.buildRunFailureScreenshotKey(runId, resultId, extension);

  storage.saveBuffer(storageKey, file.buffer);



  result.failureScreenshot = storageKey;

  testRun.markModified('results');

  await testRun.save();



  return {

    failureScreenshot: storageKey,

  };

};



module.exports = {

  getRunResultFailureScreenshotService,

  uploadRunResultFailureScreenshotService,

};

