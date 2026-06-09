const mongoose = require('mongoose');
const Project = require('../models/Project');
const IssueType = require('../models/IssueType');
const TestCaseGroup = require('../models/TestCaseGroup');
const { httpError } = require('../utils/httpError');
const { buildSearchMatch, createEntityId, normalizeKey, normalizeName } = require('../utils/versioning');
const {
  activeLatestFilter,
  buildVersionedList,
  extractReferenceId,
  getVersionHistory,
  restoreVersionSeries,
  softDeleteVersionSeries,
  toObjectId,
  updateVersionedDocument,
} = require('./shared/versioningCore');
const {
  ensureProjectExists,
  resolveLatestProjectSnapshot,
} = require('./shared/testManagementResolvers');
const { buildIssueTypeGroupServices } = require('./issueTypeGroupService');

module.exports = buildIssueTypeGroupServices({
  mongoose,
  Project,
  IssueType,
  TestCaseGroup,
  httpError,
  normalizeName,
  normalizeKey,
  buildSearchMatch,
  createEntityId,
  buildVersionedList,
  extractReferenceId,
  activeLatestFilter,
  toObjectId,
  ensureProjectExists,
  resolveLatestProjectSnapshot,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
  getVersionHistory,
});
