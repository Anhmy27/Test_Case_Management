const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { httpError } = require('../utils/httpError');
const { repointVersionReferences } = require('../utils/entityResolvers');
const { buildSearchMatch, normalizeKey, normalizeName } = require('../utils/versioning');
const {
  activeLatestFilter,
  toObjectId,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
} = require('./shared/versioningCore');
const {
  ensureProjectExists,
  resolveLatestProjectSnapshot,
} = require('./shared/testManagementResolvers');
const { buildProjectVersionServices } = require('./projectVersionService');

module.exports = buildProjectVersionServices({
  mongoose,
  Project,
  Version,
  TestCaseGroup,
  TestCase,
  TestPlan,
  TestRun,
  httpError,
  repointVersionReferences,
  normalizeKey,
  normalizeName,
  buildSearchMatch,
  activeLatestFilter,
  toObjectId,
  ensureProjectExists,
  resolveLatestProjectSnapshot,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
});
