/**
 * Shared entity resolver helpers used across run lifecycle, dashboard, and automation services.
 * All functions are stateless — they query MongoDB and return plain objects (lean).
 */

const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const { httpError } = require('./httpError');

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }
  return new mongoose.Types.ObjectId(id);
};

const isPlanAssignedToUser = (testPlan, userId) => {
  const extractId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) return String(value._id || value.id || '');
    return String(value);
  };

  const ownerMatch = extractId(testPlan.owner) === userId;
  const assigneeMatch = Array.isArray(testPlan.assignees)
    && testPlan.assignees.some((assignee) => extractId(assignee) === userId);
  return ownerMatch || assigneeMatch;
};

const extractUserRef = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const id = value._id || value.id;
    return id ? String(id) : undefined;
  }
  return String(value);
};

/**
 * Resolve owner/assignees/tester for a plan item.
 * Item-level fields take precedence; plan-level fields are the fallback.
 */
const resolvePlanItemAssignment = (item, plan) => {
  const itemOwner = item?.owner ? extractUserRef(item.owner) : undefined;
  const itemAssignees = Array.isArray(item?.assignees) && item.assignees.length > 0
    ? item.assignees.map(extractUserRef).filter(Boolean)
    : null;

  const owner = itemOwner || extractUserRef(plan?.owner);
  const assignees = itemAssignees
    ?? (Array.isArray(plan?.assignees)
      ? plan.assignees.map(extractUserRef).filter(Boolean)
      : []);

  const tester = owner || assignees[0] || undefined;

  return { owner, assignees, tester };
};

// ---------------------------------------------------------------------------
// Entity finders — always return the latest non-deleted document
// ---------------------------------------------------------------------------

const findTestPlanByReference = async (testPlanRef) => {
  if (!testPlanRef) return null;
  const objectId = toObjectId(testPlanRef, 'testPlanId');
  return TestPlan.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

const getTestPlanVersionIds = async (testPlan) => {
  if (!testPlan) return [];
  const planEntityId = testPlan.entityId || testPlan._id;
  const versionIds = await TestPlan.distinct('_id', { entityId: planEntityId, deletedAt: null });
  if (versionIds.length > 0) return versionIds;
  return testPlan._id ? [testPlan._id] : [];
};

const findLatestTestCaseByReference = async (testCaseRef) => {
  if (!testCaseRef) return null;
  const objectId = toObjectId(testCaseRef, 'testCaseId');
  const referencedCase = await TestCase.findOne({
    $or: [{ _id: objectId }, { entityId: objectId }],
  }).lean();
  if (!referencedCase) return null;
  const entityId = referencedCase.entityId || referencedCase._id;
  const latestCase = await TestCase.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
  return latestCase || referencedCase;
};

const findProjectByReference = async (projectRef) => {
  if (!projectRef) return null;
  const objectId = toObjectId(projectRef, 'projectId');
  const referencedProject = await Project.findOne({
    $or: [{ entityId: objectId }, { _id: objectId }],
  }).lean();
  if (!referencedProject) return null;
  const entityId = referencedProject.entityId || referencedProject._id;
  const latestProject = await Project.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
  return latestProject || (referencedProject.deletedAt ? null : referencedProject);
};

const findVersionByReference = async (versionRef) => {
  if (!versionRef) return null;
  const objectId = toObjectId(versionRef, 'versionId');
  const referencedVersion = await Version.findOne({
    $or: [{ entityId: objectId }, { _id: objectId }],
  }).lean();
  if (!referencedVersion) return null;
  const entityId = referencedVersion.entityId || referencedVersion._id;
  const latestVersion = await Version.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
  return latestVersion || (referencedVersion.deletedAt ? null : referencedVersion);
};

// ---------------------------------------------------------------------------
// Run payload enrichers — attach resolved references to a plain TestRun object
// ---------------------------------------------------------------------------

const attachRunTestPlan = async (testRun) => {
  const resolvedPlan = await findTestPlanByReference(testRun?.testPlan);
  return {
    ...testRun,
    testPlan: resolvedPlan
      ? {
          _id: resolvedPlan._id,
          entityId: resolvedPlan.entityId,
          name: resolvedPlan.name,
          executionMode: resolvedPlan.executionMode,
        }
      : testRun?.testPlan || null,
  };
};

const attachRunProjectAndVersion = async (testRun) => {
  const [project, version] = await Promise.all([
    findProjectByReference(testRun?.project),
    findVersionByReference(testRun?.version),
  ]);

  return {
    ...testRun,
    project: project
      ? {
          _id: project._id,
          entityId: project.entityId,
          name: project.name,
          code: project.code,
          pid: project.pid,
          jiraProjectKey: project.jiraProjectKey,
          jiraProductKey: project.jiraProductKey,
        }
      : testRun?.project || null,
    version: version
      ? {
          _id: version._id,
          entityId: version.entityId,
          name: version.name,
        }
      : testRun?.version || null,
  };
};

module.exports = {
  toObjectId,
  isPlanAssignedToUser,
  resolvePlanItemAssignment,
  findTestPlanByReference,
  getTestPlanVersionIds,
  findLatestTestCaseByReference,
  findProjectByReference,
  findVersionByReference,
  attachRunTestPlan,
  attachRunProjectAndVersion,
};
