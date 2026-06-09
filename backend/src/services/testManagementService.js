const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Project = require('../models/Project');
const Version = require('../models/Version');
const IssueType = require('../models/IssueType');
const TestCase = require('../models/TestCase');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { httpError } = require('../utils/httpError');
const { repointVersionReferences } = require('../utils/entityResolvers');
const {
  buildSearchMatch,
  createEntityId,
  normalizeKey,
  normalizeName,
  pickPagination,
} = require('../utils/versioning');
const { buildProjectVersionServices } = require('./projectVersionService');
const { buildIssueTypeGroupServices } = require('./issueTypeGroupService');
const { buildTestCaseServices } = require('./testCaseService');
const { buildTestPlanServices } = require('./testPlanService');

const activeLatestFilter = () => ({
  deletedAt: null,
  $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
});

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const objectIdString = (value) => String(value || '');

const extractReferenceId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }

    const candidate = value.entityId || value._id || value.id;
    return candidate ? String(candidate) : '';
  }

  return '';
};

const normalizeStepExpected = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const normalizeManualSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && String(step.action || '').trim())
    .map((step, index) => ({
      order: index + 1,
      action: String(step.action).trim(),
      expected: normalizeStepExpected(step.expected),
    }));
};

const normalizeOverallExpected = (value) => String(value || '').trim();

const normalizeAutomationSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && step.action)
    .map((step, index) => ({
      stepId: String(step.stepId || '').trim() || String(index + 1),
      stepName: String(step.stepName || '').trim(),
      order: index + 1,
      action: String(step.action || 'goto').trim(),
      targetType: String(step.targetType || 'css').trim(),
      target: String(step.target || '').trim(),
      value: String(step.value || '').trim(),
      expected: String(step.expected || '').trim(),
      timeoutMs: Number(step.timeoutMs || 15000),
    }));
};

const applyPopulate = (query, populate = []) => {
  for (const entry of populate) {
    query.populate(entry);
  }

  return query;
};

const buildVersionedList = async ({
  model,
  query,
  search,
  searchFields,
  baseFilters = {},
  populate = [],
  sort = { createdAt: -1 },
  includeDeleted = false,
}) => {
  const { page, limit, skip } = pickPagination(query);
  const filters = [];

  Object.entries(baseFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      filters.push({ [key]: value });
    }
  });

  if (!includeDeleted) {
    filters.push(activeLatestFilter());
  }

  if (search) {
    const searchMatch = buildSearchMatch(search, searchFields);
    if (Object.keys(searchMatch).length > 0) {
      filters.push(searchMatch);
    }
  }

  const match = filters.length === 0
    ? {}
    : filters.length === 1
      ? filters[0]
      : { $and: filters };

  const countPromise = model.countDocuments(match);
  let docsQuery = model.find(match).sort(sort);
  if (limit) {
    docsQuery = docsQuery.skip(skip).limit(limit);
  }

  docsQuery = applyPopulate(docsQuery, populate);

  const [total, docs] = await Promise.all([
    countPromise,
    docsQuery.lean(),
  ]);

  return {
    docs,
    pagination: limit
      ? {
          page,
          limit,
          total,
          pages: Math.max(Math.ceil(total / limit), 1),
        }
      : null,
  };
};

const ensureProjectExists = async (projectId, { includeDeleted = false } = {}) => {
  // Try resolving by entityId first, then by document _id
  const entityQuery = { entityId: toObjectId(projectId, 'projectId') };
  if (!includeDeleted) {
    entityQuery.$or = [{ isLatest: true }, { isLatest: { $exists: false } }];
    entityQuery.deletedAt = null;
  }

  let project = await Project.findOne(entityQuery).lean();
  if (project) return project;

  // Fallback: try by document _id
  const idQuery = { _id: toObjectId(projectId, 'projectId') };
  if (!includeDeleted) {
    idQuery.deletedAt = null;
  }
  project = await Project.findOne(idQuery).lean();
  if (!project) throw httpError(404, 'Project not found');
  // Backfill entityId if missing (some older docs may not have it)
  if (!project.entityId) {
    await Project.findByIdAndUpdate(project._id, { $set: { entityId: project._id } });
    project.entityId = project._id;
  }
  return project;
};

const resolveLatestProjectSnapshot = async (projectId, { includeDeleted = false } = {}) => {
  const resolvedProject = await ensureProjectExists(projectId, { includeDeleted });
  const latestProject = await Project.findOne({
    entityId: resolvedProject.entityId || resolvedProject._id,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();

  return latestProject || resolvedProject;
};

const ensureVersionExists = async (versionId, projectId, { includeDeleted = false } = {}) => {
  const project = await ensureProjectExists(projectId, { includeDeleted });

  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectRefs = Array.from(
    new Set([...(projectVersionIds || []), project._id, project.entityId].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));
  const base = { project: { $in: projectRefs } };
  if (!includeDeleted) {
    base.$or = [{ isLatest: true }, { isLatest: { $exists: false } }];
    base.deletedAt = null;
  }

  // Try by entityId then fallback to _id
  let version = await Version.findOne({ entityId: toObjectId(versionId, 'versionId'), ...base }).lean();
  if (version) return version;

  version = await Version.findOne({ _id: toObjectId(versionId, 'versionId'), ...base }).lean();
  if (!version) throw httpError(404, 'Version not found in selected project');
  if (!version.entityId) {
    await Version.findByIdAndUpdate(version._id, { $set: { entityId: version._id } });
    version.entityId = version._id;
  }
  return version;
};

const ensureGroupExists = async (groupId, projectId, { includeDeleted = false } = {}) => {
  const project = await ensureProjectExists(projectId, { includeDeleted });

  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const allowedProjectRefs = new Set(
    [
      ...(projectVersionIds || []),
      project._id,
      project.entityId,
    ]
      .filter(Boolean)
      .map((value) => String(value)),
  );

  const groupMatch = {
    $or: [
      { entityId: toObjectId(groupId, 'groupId') },
      { _id: toObjectId(groupId, 'groupId') },
    ],
  };

  const group = await TestCaseGroup.findOne({
    $and: [
      groupMatch,
      ...(includeDeleted
        ? []
        : [
            {
              $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
              deletedAt: null,
            },
          ]),
    ],
  }).lean();

  if (!group) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  const groupProjectRef = extractReferenceId(group.project);
  if (!allowedProjectRefs.has(groupProjectRef)) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  return group;
};

const buildTestCaseConflict = async (duplicate, fallbackGroupId) => {
  const duplicateGroupRef = duplicate?.group || fallbackGroupId || null;
  let duplicateGroup = null;
  if (duplicateGroupRef) {
    const groupDoc = await TestCaseGroup.findOne({
      $or: [
        { _id: duplicateGroupRef },
        { entityId: duplicateGroupRef },
      ],
    }).select('entityId _id name key').lean();

    const latestGroupEntityId = groupDoc?.entityId || groupDoc?._id || duplicateGroupRef;
    duplicateGroup = await TestCaseGroup.findOne({
      entityId: latestGroupEntityId,
      deletedAt: null,
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    }).select('entityId _id name key').lean() || groupDoc;
  }

  return {
    testCaseId: String(duplicate?._id || ''),
    entityId: String(duplicate?.entityId || ''),
    key: duplicate?.key || '',
    title: duplicate?.title || duplicate?.name || '',
    groupId: String(duplicateGroup?._id || duplicateGroupRef || ''),
    groupEntityId: String(duplicateGroup?.entityId || ''),
    groupName: String(duplicateGroup?.name || ''),
    groupKey: String(duplicateGroup?.key || ''),
  };
};

const createVersionedDocument = async (Model, payload, session) => {
  const [doc] = await Model.create([
    {
      ...payload,
      entityId: payload.entityId || createEntityId(),
      versionNumber: payload.versionNumber || 1,
      isLatest: payload.isLatest !== undefined ? payload.isLatest : true,
      deletedAt: payload.deletedAt || null,
      previousVersionId: payload.previousVersionId || null,
    },
  ], session ? { session } : undefined);

  return doc;
};

const findVersionedCurrentDocument = async (Model, currentId, { includeDeleted = false } = {}) => {
  const objectId = toObjectId(currentId, 'entityId');
  const query = {
    $and: [
      {
        $or: [
          { entityId: objectId },
          { _id: objectId },
        ],
      },
    ],
  };

  if (!includeDeleted) {
    query.$and.push({ $or: [{ isLatest: true }, { isLatest: { $exists: false } }] });
    query.$and.push({ deletedAt: null });
  }

  return Model.findOne(query);
};

const resolveTestCaseByReference = async (testCaseRef, { includeDeleted = false } = {}) => {
  if (!testCaseRef) {
    return null;
  }

  const match = {
    $or: [
      { entityId: toObjectId(testCaseRef, 'testCaseId') },
      { _id: toObjectId(testCaseRef, 'testCaseId') },
    ],
  };

  if (!includeDeleted) {
    match.$and = [activeLatestFilter()];
  }

  return TestCase.findOne(match).lean();
};

const attachTestPlanCases = async (testPlan) => {
  if (!testPlan) {
    return null;
  }

  const referencedCaseIds = Array.from(new Set((testPlan.items || [])
    .map((item) => extractReferenceId(item.testCase))
    .filter(Boolean)));

  const attachedCases = referencedCaseIds.length > 0
    ? await TestCase.find({
        $or: [
          { _id: { $in: referencedCaseIds.filter((value) => mongoose.Types.ObjectId.isValid(value)).map((value) => toObjectId(value, 'testCaseId')) } },
          { entityId: { $in: referencedCaseIds.filter((value) => mongoose.Types.ObjectId.isValid(value)).map((value) => toObjectId(value, 'testCaseId')) } },
        ],
      }).select('entityId key name caseKey title deletedAt').lean()
    : [];

  const caseMap = new Map();
  for (const testCase of attachedCases) {
    caseMap.set(String(testCase._id), testCase);
    if (testCase.entityId) caseMap.set(String(testCase.entityId), testCase);
  }

  return {
    ...testPlan,
    items: (testPlan.items || []).map((item) => ({
      ...item,
      testCase: caseMap.get(extractReferenceId(item.testCase)) || item.testCase || null,
    })),
  };
};

const updateVersionedDocument = async (Model, currentId, buildNextPayload) => {
  const current = await findVersionedCurrentDocument(Model, currentId);
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  if (current.deletedAt) {
    throw httpError(409, 'Deleted records must be restored before editing');
  }

  if (current.isLatest === false) {
    throw httpError(409, 'Historical versions cannot be edited directly');
  }

  const originalIsLatest = current.isLatest;
  current.isLatest = false;
  await current.save();

  try {
    const nextPayload = await buildNextPayload(current.toObject({ depopulate: true }));
    const next = await createVersionedDocument(
      Model,
      {
        ...nextPayload,
        entityId: current.entityId,
        versionNumber: Number(current.versionNumber || 1) + 1,
        previousVersionId: current._id,
      },
    );

    return next;
  } catch (error) {
    current.isLatest = originalIsLatest;
    await current.save();
    throw error;
  }
};

const softDeleteVersionSeries = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true });
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  const deletedAt = new Date();

  await Model.updateMany({ entityId }, { $set: { deletedAt } });
};

const restoreVersionSeries = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true });
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  await Model.updateMany({ entityId }, { $set: { deletedAt: null } });
};

const getVersionHistory = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true }).lean();
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  return Model.find({ entityId }).sort({ versionNumber: 1 }).lean();
};

const getCurrentVersionById = async (Model, id) => {
  const doc = await Model.findOne({
    entityId: toObjectId(id, 'entityId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!doc) {
    throw httpError(404, 'Entity not found');
  }

  return doc;
};

const isPlanAssignedToUser = (testPlan, userId) => {
  const getUserId = (value) => {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      return String(value._id || value.id || '');
    }

    return String(value);
  };

  const ownerMatch = getUserId(testPlan.owner) === userId;
  const assigneeMatch = Array.isArray(testPlan.assignees)
    && testPlan.assignees.some((assignee) => getUserId(assignee) === userId);
  return ownerMatch || assigneeMatch;
};

const {
  createProjectService,
  listProjectsService,
  getProjectService,
  updateProjectService,
  deleteProjectService,
  restoreProjectService,
  createVersionService,
  listVersionsService,
  getVersionService,
  updateVersionService,
  deleteVersionService,
  restoreVersionService,
} = buildProjectVersionServices({
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

const {
  createIssueTypeService,
  listIssueTypesService,
  getIssueTypeService,
  updateIssueTypeService,
  deleteIssueTypeService,
  createTestCaseGroupService,
  listTestCaseGroupsService,
  getTestCaseGroupService,
  getTestCaseGroupVersionsService,
  updateTestCaseGroupService,
  deleteTestCaseGroupService,
  restoreTestCaseGroupService,
} = buildIssueTypeGroupServices({
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

const {
  createTestCaseService,
  listTestCasesService,
  listTestCaseDetailsService,
  importTestCasesService,
  getTestCaseService,
  getTestCaseVersionsService,
  updateTestCaseService,
  deleteTestCaseService,
  restoreTestCaseService,
} = buildTestCaseServices({
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

const {
  createTestPlanService,
  listTestPlansService,
  getTestPlanService,
  getTestPlanVersionsService,
  assignTestPlanItemsService,
  updateTestPlanService,
  deleteTestPlanService,
  restoreTestPlanService,
} = buildTestPlanServices({
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

module.exports = {
  createProjectService,
  listProjectsService,
  getProjectService,
  updateProjectService,
  deleteProjectService,
  restoreProjectService,
  createVersionService,
  listVersionsService,
  getVersionService,
  updateVersionService,
  deleteVersionService,
  restoreVersionService,
  createIssueTypeService,
  listIssueTypesService,
  getIssueTypeService,
  updateIssueTypeService,
  deleteIssueTypeService,
  createTestCaseGroupService,
  listTestCaseGroupsService,
  getTestCaseGroupService,
  getTestCaseGroupVersionsService,
  updateTestCaseGroupService,
  deleteTestCaseGroupService,
  restoreTestCaseGroupService,
  createTestCaseService,
  listTestCasesService,
  listTestCaseDetailsService,
  importTestCasesService,
  getTestCaseService,
  getTestCaseVersionsService,
  updateTestCaseService,
  deleteTestCaseService,
  restoreTestCaseService,
  createTestPlanService,
  listTestPlansService,
  getTestPlanService,
  getTestPlanVersionsService,
  assignTestPlanItemsService,
  updateTestPlanService,
  deleteTestPlanService,
  restoreTestPlanService,
};
