/**
 * Shared entity resolver helpers used across run lifecycle, dashboard, and automation services.
 * All functions are stateless — they query MongoDB and return plain objects (lean).
 */

const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
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

const normalizeReferenceId = (ref) => {
  if (ref === undefined || ref === null || ref === '') {
    return null;
  }

  // Raw BSON ObjectId instance (e.g. from .lean() without .populate()) — pass through directly
  if (ref instanceof mongoose.Types.ObjectId) {
    return ref;
  }

  if (typeof ref === 'object') {
    // Populated Mongoose document: prefer entityId, then _id
    if (ref.entityId) return ref.entityId;
    if (ref._id) return ref._id;
    // Note: do NOT use ref.id here — on BSON ObjectIds it is a raw Buffer, not a hex string
  }

  return ref;
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
  const versionDocIds = await TestPlan.distinct('_id', { entityId: planEntityId });

  const ids = new Set(versionDocIds.map((id) => String(id)));
  if (testPlan._id) ids.add(String(testPlan._id));
  ids.add(String(planEntityId));

  return Array.from(ids).map((value) => toObjectId(value, 'testPlanId'));
};

const findLatestTestCaseByReference = async (testCaseRef) => {
  const normalizedRef = normalizeReferenceId(testCaseRef);
  if (!normalizedRef) return null;
  const objectId = toObjectId(normalizedRef, 'testCaseId');
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
  const normalizedRef = normalizeReferenceId(projectRef);
  if (!normalizedRef) return null;
  const objectId = toObjectId(normalizedRef, 'projectId');
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
  const normalizedRef = normalizeReferenceId(versionRef);
  if (!normalizedRef) return null;
  const objectId = toObjectId(normalizedRef, 'versionId');
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

const repointVersionReferences = async (versionEntityId, latestVersionDoc) => {
  if (!versionEntityId || !latestVersionDoc?._id) {
    return;
  }

  const entityObjectId = toObjectId(String(versionEntityId), 'versionId');
  const versionSnapshotIds = await Version.find({ entityId: entityObjectId }).distinct('_id');
  const staleVersionIds = versionSnapshotIds.filter(
    (snapshotId) => String(snapshotId) !== String(latestVersionDoc._id),
  );

  if (staleVersionIds.length === 0) {
    return;
  }

  await Promise.all([
    TestPlan.updateMany(
      { version: { $in: staleVersionIds } },
      { $set: { version: latestVersionDoc._id, versionVersionId: latestVersionDoc._id } },
    ),
    TestRun.updateMany(
      { version: { $in: staleVersionIds } },
      { $set: { version: latestVersionDoc._id } },
    ),
  ]);
};

// ---------------------------------------------------------------------------
// Run payload enrichers — attach resolved references to a plain TestRun object
// ---------------------------------------------------------------------------

const findTestPlanSnapshotForRun = async (testPlanRef) => {
  const normalizedRef = normalizeReferenceId(testPlanRef);
  if (!normalizedRef) return null;

  const objectId = toObjectId(normalizedRef, 'testPlanId');
  const referencedPlan = await TestPlan.findOne({
    $or: [{ _id: objectId }, { entityId: objectId }],
  }).lean();

  if (!referencedPlan) return null;

  const entityId = referencedPlan.entityId || referencedPlan._id;
  const latestPlan = await TestPlan.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  })
    .select('name executionMode entityId')
    .lean();

  const snapshot = latestPlan || referencedPlan;

  return {
    _id: snapshot._id,
    entityId,
    name: snapshot.name,
    executionMode: snapshot.executionMode,
  };
};

const attachRunTestPlan = async (testRun) => {
  const resolvedPlan = await findTestPlanSnapshotForRun(testRun?.testPlan);
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
  findTestPlanSnapshotForRun,
  findLatestTestCaseByReference,
  findProjectByReference,
  findVersionByReference,
  repointVersionReferences,
  attachRunTestPlan,
  attachRunProjectAndVersion,
};
