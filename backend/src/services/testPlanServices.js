const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestPlan = require('../models/TestPlan');
const { httpError } = require('../utils/httpError');
const { createEntityId, normalizeKey, normalizeName } = require('../utils/versioning');
const {
  activeLatestFilter,
  buildVersionedList,
  extractReferenceId,
  getVersionHistory,
  isPlanAssignedToUser,
  restoreVersionSeries,
  softDeleteVersionSeries,
  toObjectId,
  updateVersionedDocument,
} = require('./shared/versioningCore');
const {
  attachTestPlanCases,
  ensureProjectExists,
  ensureVersionExists,
  resolveTestCaseByReference,
} = require('./shared/testManagementResolvers');
const { buildTestPlanServices } = require('./testPlanService');

module.exports = buildTestPlanServices({
  mongoose,
  Project,
  Version,
  TestPlan,
  httpError,
  normalizeKey,
  normalizeName,
  createEntityId,
  activeLatestFilter,
  toObjectId,
  buildVersionedList,
  getVersionHistory,
  ensureProjectExists,
  ensureVersionExists,
  resolveTestCaseByReference,
  extractReferenceId,
  attachTestPlanCases,
  isPlanAssignedToUser,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
});
