const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Project = require('../models/Project');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { httpError } = require('../utils/httpError');
const { buildSearchMatch, createEntityId, normalizeKey, normalizeName } = require('../utils/versioning');
const {
  activeLatestFilter,
  buildVersionedList,
  extractReferenceId,
  getVersionHistory,
  normalizeAutomationSteps,
  normalizeManualSteps,
  normalizeOverallExpected,
  normalizeStepExpected,
  objectIdString,
  restoreVersionSeries,
  softDeleteVersionSeries,
  toObjectId,
  updateVersionedDocument,
} = require('./shared/versioningCore');
const {
  buildTestCaseConflict,
  ensureGroupExists,
  ensureProjectExists,
} = require('./shared/testManagementResolvers');
const { buildTestCaseServices } = require('./testCaseService');

module.exports = buildTestCaseServices({
  mongoose,
  XLSX,
  Project,
  TestCaseGroup,
  TestCase,
  TestPlan,
  TestRun,
  httpError,
  normalizeKey,
  normalizeName,
  buildSearchMatch,
  activeLatestFilter,
  toObjectId,
  extractReferenceId,
  objectIdString,
  createEntityId,
  buildVersionedList,
  getVersionHistory,
  ensureProjectExists,
  ensureGroupExists,
  buildTestCaseConflict,
  normalizeOverallExpected,
  normalizeStepExpected,
  normalizeManualSteps,
  normalizeAutomationSteps,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
});
