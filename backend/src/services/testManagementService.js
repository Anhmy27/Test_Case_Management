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
const {
  buildSearchMatch,
  createEntityId,
  normalizeKey,
  normalizeName,
  pickPagination,
} = require('../utils/versioning');

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

    const candidate = value._id || value.entityId || value.id;
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

const ensureTestCaseExists = async (testCaseId, projectId, { includeDeleted = false } = {}) => {
  const project = await ensureProjectExists(projectId, { includeDeleted });

  // Accept test cases whose `project` field stores either the project's version _id
  // or the project's stable `entityId`.
  const projectIds = [project._id];
  if (project.entityId) projectIds.push(project.entityId);

  const base = { project: { $in: projectIds } };
  if (!includeDeleted) {
    base.$and = [activeLatestFilter()];
  }

  // Try resolving by test case entityId first, then by document _id, scoping to allowed project ids
  let testCase = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId'), ...base }).lean();
  if (testCase) return testCase;

  testCase = await TestCase.findOne({ _id: toObjectId(testCaseId, 'testCaseId'), ...base }).lean();
  if (!testCase) throw httpError(404, 'Test case not found in selected project');
  return testCase;
};

const buildCasePayload = ({
  projectId,
  groupId,
  caseKey,
  title,
  key,
  name,
  description,
  expected,
  steps,
  priority,
  severity,
  type,
  status,
  createdBy,
}) => {
  const normalizedKey = normalizeKey(key || caseKey);
  const normalizedName = normalizeName(name || title);
  const normalizedSteps = normalizeManualSteps(steps);

  return {
    project: toObjectId(projectId, 'projectId'),
    group: toObjectId(groupId, 'groupId'),
    key: normalizedKey,
    name: normalizedName,
    caseKey: normalizedKey,
    title: normalizedName,
    description: description || '',
    expected: normalizeOverallExpected(expected),
    steps: normalizedSteps,
    priority: priority || 'medium',
    severity: severity || 'major',
    type: type || 'functional',
    status: status || 'active',
    createdBy: createdBy ? toObjectId(createdBy, 'createdBy') : undefined,
  };
};

const buildPlanPayload = ({
  projectId,
  versionId,
  name,
  key,
  description,
  caseIds,
  executionMode,
  owner,
  assignees,
  createdBy,
}) => {
  const normalizedKey = normalizeKey(key || name);
  const normalizedName = normalizeName(name);
  const items = Array.isArray(caseIds)
    ? caseIds.map((id, index) => ({
        testCase: toObjectId(id, `caseIds[${index}]`),
        order: index + 1,
        owner: owner ? toObjectId(owner, 'ownerId') : undefined,
        assignees: Array.isArray(assignees)
          ? assignees.map((assigneeId, assigneeIndex) => toObjectId(assigneeId, `assigneeIds[${assigneeIndex}]`))
          : [],
      }))
    : [];

  return {
    project: toObjectId(projectId, 'projectId'),
    version: toObjectId(versionId, 'versionId'),
    key: normalizedKey,
    name: normalizedName,
    description: description || '',
    executionMode: executionMode === 'automation' ? 'automation' : 'manual',
    owner: owner ? toObjectId(owner, 'ownerId') : undefined,
    assignees: Array.isArray(assignees)
      ? assignees.map((assigneeId, index) => toObjectId(assigneeId, `assigneeIds[${index}]`))
      : [],
    items,
    createdBy: createdBy ? toObjectId(createdBy, 'createdBy') : undefined,
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

// Project domain services (HTTP-agnostic)
const createProjectService = async ({ name, code, description, pid, jiraProjectKey, jiraProductKey, createdBy }) => {
  if (!name || !code) {
    throw httpError(400, 'name and code are required');
  }

  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeKey(code);
  const incomingJiraProjectKey = jiraProjectKey !== undefined ? jiraProjectKey : jiraProductKey;

  const existingProject = await Project.findOne({
    $and: [
      activeLatestFilter(),
      { $or: [{ code: normalizedCode }, { name: normalizedName }] },
    ],
  }).lean();
  if (existingProject) {
    throw httpError(409, 'Project name or code already exists');
  }

  const project = await Project.create({
    name: normalizedName,
    code: normalizedCode,
    pid: pid ? String(pid).trim() : '',
    jiraProjectKey: incomingJiraProjectKey ? String(incomingJiraProjectKey).trim() : '',
    description: description || '',
    createdBy,
  });

  return project;
};

const listProjectsService = async ({ search, includeDeleted }) => {
  const filters = [];

  if (includeDeleted !== 'true') {
    filters.push({ deletedAt: null });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['name', 'code', 'description']));
  }

  filters.push({
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  });

  const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
  return Project.find(match).sort({ createdAt: -1 }).lean();
};

const getProjectService = async (projectId) => {
  return Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
};

const updateProjectService = async (projectId, payload) => {
  const { name, code, description, status, pid, jiraProjectKey, jiraProductKey } = payload;
  const incomingJiraProjectKey = jiraProjectKey !== undefined ? jiraProjectKey : jiraProductKey;

  return updateVersionedDocument(Project, projectId, async (current) => {
    const nextName = name ? normalizeName(name) : current.name;
    const nextCode = code ? normalizeKey(code) : current.code;

    const duplicate = await Project.findOne({
      _id: { $ne: current._id },
      entityId: { $ne: current.entityId },
      $and: [
        activeLatestFilter(),
        { $or: [{ code: nextCode }, { name: nextName }] },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Project name or code already exists');
    }

    return {
      name: nextName,
      code: nextCode,
      description: description !== undefined ? description || '' : current.description,
      pid: pid !== undefined ? (pid ? String(pid).trim() : '') : current.pid,
      jiraProjectKey: incomingJiraProjectKey !== undefined ? (incomingJiraProjectKey ? String(incomingJiraProjectKey).trim() : '') : current.jiraProjectKey,
      status: status && ['active', 'archived'].includes(status) ? status : current.status,
      createdBy: current.createdBy,
    };
  });
};

const deleteProjectService = async (projectId) => {
  const project = await Project.findOne({ entityId: toObjectId(projectId, 'projectId') }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const projectRefs = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectIdRefs = Array.from(
    new Set([...(projectRefs || []), project.entityId].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));

  const [versionCount, groupCount, caseCount, planCount, runCount] = await Promise.all([
    Version.countDocuments({ project: { $in: projectIdRefs } }),
    TestCaseGroup.countDocuments({ project: { $in: projectIdRefs } }),
    TestCase.countDocuments({ project: { $in: projectIdRefs } }),
    TestPlan.countDocuments({ project: { $in: projectIdRefs } }),
    TestRun.countDocuments({ project: { $in: projectIdRefs } }),
  ]);

  if (versionCount || groupCount || caseCount || planCount || runCount) {
    throw httpError(409, 'Project has related records and cannot be deleted');
  }

  await softDeleteVersionSeries(Project, projectId);
};

const restoreProjectService = async (projectId) => {
  const project = await Project.findOne({ entityId: toObjectId(projectId, 'projectId') }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const duplicate = await Project.findOne({
    entityId: { $ne: project.entityId },
    $and: [
      activeLatestFilter(),
      { $or: [{ code: project.code }, { name: project.name }] },
    ],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Another active project already uses the same name or code');
  }

  await restoreVersionSeries(Project, projectId);
  return Project.findOne({ entityId: project.entityId, $or: [{ isLatest: true }, { isLatest: { $exists: false } }], deletedAt: null }).lean();
};

// Release version CRUD
const createVersionService = async ({ projectId, name, releaseDate, notes, createdBy }) => {
  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await ensureProjectExists(projectId);
  const normalizedName = normalizeName(name);
  const projectRef = project.entityId || project._id;

  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectRefs = Array.from(
    new Set([...(projectVersionIds || []), project._id, project.entityId].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));

  const existingVersion = await Version.findOne({
    project: { $in: projectRefs },
    deletedAt: null,
    isLatest: true,
    name: normalizedName,
  }).lean();
  if (existingVersion) {
    throw httpError(409, `Version "${name}" already exists in this project`);
  }

  const version = await Version.create({
    project: projectRef,
    projectVersionId: project._id,
    name: normalizedName,
    releaseDate,
    notes: notes || '',
    createdBy,
  });

  const populatedVersion = await Version.findById(version._id).lean();
  let projectObj = null;
  if (populatedVersion && populatedVersion.project) {
    projectObj = await Project.findOne({
      $and: [
        {
          $or: [
            { _id: populatedVersion.project },
            { entityId: populatedVersion.project },
          ],
        },
        { deletedAt: null },
        activeLatestFilter(),
      ],
    }).select('entityId name code deletedAt').lean();
  }

  return {
    ...populatedVersion,
    project: projectObj || (populatedVersion ? populatedVersion.project : null),
  };
};

const listVersionsService = async ({ projectId, search, includeDeleted }) => {
  const filters = [];

  if (projectId) {
    const project = await ensureProjectExists(projectId);
    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
    filters.push({ project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } });
  } else {
    const activeProjects = await Project.find({ deletedAt: null }).select('_id entityId').lean();
    const activeProjectIds = Array.from(
      new Set(activeProjects.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean)),
    );
    filters.push({ project: { $in: activeProjectIds.map((value) => toObjectId(value, 'projectId')) } });
  }

  if (includeDeleted !== 'true') {
    filters.push({ deletedAt: null });
    filters.push({ $or: [{ isLatest: true }, { isLatest: { $exists: false } }] });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['name', 'notes']));
  }

  const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
  const versions = await Version.find(match)
    .sort({ createdAt: -1 })
    .lean();

  const referencedProjectIds = Array.from(new Set(versions.map((version) => String(version.project || '')).filter(Boolean)));
  const referencedProjects = referencedProjectIds.length > 0
    ? await Project.find({
        $or: [
          { _id: { $in: referencedProjectIds.filter((value) => mongoose.Types.ObjectId.isValid(value)).map((value) => toObjectId(value, 'projectId')) } },
          { entityId: { $in: referencedProjectIds.filter((value) => mongoose.Types.ObjectId.isValid(value)).map((value) => toObjectId(value, 'projectId')) } },
        ],
      }).select('entityId name code deletedAt').lean()
    : [];

  const projectMap = new Map();
  for (const project of referencedProjects) {
    projectMap.set(String(project._id), project);
    if (project.entityId) projectMap.set(String(project.entityId), project);
  }

  return versions.map((version) => ({
    ...version,
    project: projectMap.get(String(version.project)) || version.project || null,
  }));
};

const getVersionService = async (versionId) => {
  let version = await Version.findOne({
    entityId: toObjectId(versionId, 'versionId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  })
    .lean();

  if (!version && mongoose.Types.ObjectId.isValid(versionId)) {
    version = await Version.findOne({
      _id: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    })
      .lean();
  }

  if (!version) {
    return null;
  }

  const project = await Project.findOne({
    $and: [
      {
        $or: [
          { _id: version.project },
          { entityId: version.project },
        ],
      },
      { deletedAt: null },
      activeLatestFilter(),
    ],
  }).select('entityId name code deletedAt').lean();

  return {
    ...version,
    project: project || version.project || null,
  };
};

const updateVersionService = async (versionId, payload) => {
  const { name, releaseDate, notes } = payload;
  const versionLookupId = toObjectId(versionId, 'versionId');
  const currentVersion = await Version.findOne({
    $and: [
      {
        $or: [
          { entityId: versionLookupId },
          { _id: versionLookupId },
        ],
      },
      activeLatestFilter(),
      { deletedAt: null },
    ],
  }).lean();
  if (!currentVersion) {
    throw httpError(404, 'Version not found');
  }

  const nextVersion = await updateVersionedDocument(Version, String(currentVersion.entityId || currentVersion._id), async (current) => {
    if (current.deletedAt) {
      throw httpError(409, 'Restore the version before editing it');
    }

    const latestProject = await resolveLatestProjectSnapshot(current.project, { includeDeleted: false });

    const nextName = name ? normalizeName(name) : current.name;
    const nextReleaseDate = releaseDate !== undefined ? (releaseDate || null) : current.releaseDate;
    const nextNotes = notes !== undefined ? notes || '' : current.notes;

    const project = await ensureProjectExists(current.project, { includeDeleted: false });
    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const currentProjectRefs = Array.from(
      new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const duplicate = await Version.findOne({
      _id: { $ne: current._id },
      entityId: { $ne: current.entityId },
      project: { $in: currentProjectRefs },
      $and: [
        activeLatestFilter(),
        { name: nextName },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, `Version "${nextName}" already exists in this project`);
    }

    return {
      project: current.project,
      projectVersionId: latestProject._id,
      name: nextName,
      releaseDate: nextReleaseDate,
      notes: nextNotes,
      createdBy: current.createdBy,
    };
  });

  const populated = await Version.findById(nextVersion._id).lean();
  const project = await Project.findOne({
    $and: [
      {
        $or: [
          { _id: populated.project },
          { entityId: populated.project },
        ],
      },
      { deletedAt: null },
      activeLatestFilter(),
    ],
  }).select('entityId name code deletedAt').lean();

  return {
    ...populated,
    project: project || populated.project || null,
  };
};

const deleteVersionService = async (versionId) => {
  const version = await Version.findOne({ entityId: toObjectId(versionId, 'versionId') });
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  version.deletedAt = new Date();
  await version.save();
};

const restoreVersionService = async (versionId) => {
  const version = await Version.findOne({ entityId: toObjectId(versionId, 'versionId') });
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  const duplicate = await Version.findOne({
    _id: { $ne: version._id },
    project: version.project,
    $and: [
      activeLatestFilter(),
      { name: version.name },
    ],
  }).lean();
  if (duplicate) {
    throw httpError(409, `Version "${version.name}" already exists in this project`);
  }

  version.deletedAt = null;
  await version.save();
  return version;
};

// Issue type domain services (HTTP-agnostic)
const createIssueTypeService = async ({ name, idjira, createdBy }) => {
  if (!name || !idjira) {
    throw httpError(400, 'name and idjira are required');
  }

  const normalizedName = normalizeName(name);
  const normalizedIdJira = String(idjira).trim();

  const duplicate = await IssueType.findOne({
    deletedAt: null,
    $or: [{ name: normalizedName }, { idjira: normalizedIdJira }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Issue type name or Jira id already exists');
  }

  return IssueType.create({
    name: normalizedName,
    idjira: normalizedIdJira,
    createdBy,
  });
};

const listIssueTypesService = async ({ search, includeDeleted }) => {
  const filters = [];

  if (includeDeleted !== 'true') {
    filters.push({ deletedAt: null });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['name', 'idjira']));
  }

  const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
  return IssueType.find(match).sort({ createdAt: -1 }).lean();
};

const getIssueTypeService = async (issueTypeId) => {
  const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId')).lean();
  if (!issueType) {
    throw httpError(404, 'Issue type not found');
  }

  return issueType;
};

const updateIssueTypeService = async (issueTypeId, payload) => {
  const { name, idjira } = payload;
  const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId'));
  if (!issueType) {
    throw httpError(404, 'Issue type not found');
  }

  if (issueType.deletedAt) {
    throw httpError(409, 'Restore the issue type before editing it');
  }

  if (name !== undefined) issueType.name = normalizeName(name);
  if (idjira !== undefined) issueType.idjira = String(idjira || '').trim();

  if (!issueType.name || !issueType.idjira) {
    throw httpError(400, 'name and idjira are required');
  }

  const duplicate = await IssueType.findOne({
    _id: { $ne: issueType._id },
    deletedAt: null,
    $or: [{ name: issueType.name }, { idjira: issueType.idjira }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Issue type name or Jira id already exists');
  }

  await issueType.save();
  return issueType;
};

const deleteIssueTypeService = async (issueTypeId) => {
  const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId'));
  if (!issueType) {
    throw httpError(404, 'Issue type not found');
  }

  issueType.deletedAt = new Date();
  await issueType.save();
};

// Test case group CRUD
const createTestCaseGroupService = async ({ projectId, name, key, description, createdBy }) => {
  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await resolveLatestProjectSnapshot(projectId);
  const normalizedName = normalizeName(name);
  const normalizedKey = normalizeKey(key || name);
  const projectRef = project.entityId || project._id;
  const projectVersionId = project._id;

  const duplicate = await TestCaseGroup.findOne({
    project: { $in: [project._id, project.entityId].filter(Boolean) },
    deletedAt: null,
    isLatest: true,
    $or: [{ key: normalizedKey }, { name: normalizedName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case group name or key already exists in this project');
  }

  return TestCaseGroup.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    project: projectRef,
    projectVersionId,
    key: normalizedKey,
    name: normalizedName,
    description: description || '',
    createdBy,
  });
};

const listTestCaseGroupsService = async ({ query, projectId, search, includeDeleted }) => {
  const baseFilters = {};

  if (projectId) {
    const project = await resolveLatestProjectSnapshot(projectId);
    try {
      const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
      const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
      baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
    } catch (err) {
      baseFilters.project = { $in: [project._id, project.entityId].filter(Boolean) };
    }
  } else {
    const activeProjects = await Project.find({ deletedAt: null }).select('_id entityId').lean();
    const activeProjectIds = Array.from(
      new Set(activeProjects.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean)),
    );
    baseFilters.project = { $in: activeProjectIds.map((value) => toObjectId(value, 'projectId')) };
  }

  const { docs: groups, pagination } = await buildVersionedList({
    model: TestCaseGroup,
    query,
    search,
    searchFields: ['key', 'name', 'description'],
    baseFilters,
    // don't rely on mongoose populate here because some records may store
    // the project's entityId in the `project` field rather than referencing
    // a project document _id. We'll attach project objects manually below.
    populate: [],
    includeDeleted: includeDeleted === 'true',
  });

  // collect referenced ids from groups to load matching projects by either _id or entityId
  const referencedIds = Array.from(new Set(groups.map((g) => extractReferenceId(g.project)).filter(Boolean)));
  let attachedProjects = [];
  if (referencedIds.length > 0) {
    // find projects where either _id or entityId matches any referenced id
    const referencedObjectIds = referencedIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
    attachedProjects = await Project.find({
      $or: [
        { _id: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
        { entityId: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
      ],
    }).select('entityId name code deletedAt').lean();
  }

  const projectMap = new Map();
  for (const p of attachedProjects) {
    projectMap.set(String(p._id), p);
    if (p.entityId) projectMap.set(String(p.entityId), p);
  }

  const normalizedGroups = groups.map((g) => {
    const gp = projectMap.get(extractReferenceId(g.project)) || null;
    return {
      ...g,
      project: gp || g.project || null,
    };
  });

  return { groups: normalizedGroups, pagination };
};

const getTestCaseGroupService = async (groupId) => {
  return TestCaseGroup.findOne({
    entityId: toObjectId(groupId, 'groupId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  })
    .populate('project', 'entityId name code deletedAt')
    .lean();
};

const getTestCaseGroupVersionsService = async (groupId) => {
  try {
    const versions = await getVersionHistory(TestCaseGroup, groupId);
    return versions;
  } catch (err) {
    return [];
  }
};

const updateTestCaseGroupService = async (groupId, { projectId, key, name, description }) => {
  return updateVersionedDocument(TestCaseGroup, groupId, async (current) => {
    let nextProject;
    if (projectId) {
      nextProject = await resolveLatestProjectSnapshot(projectId, { includeDeleted: false });
    } else {
      nextProject = await resolveLatestProjectSnapshot(current.project, { includeDeleted: false });
    }

    const nextProjectRef = nextProject.entityId || nextProject._id;
    const nextProjectVersionId = nextProject._id;

    const normalizedName = name ? normalizeName(name) : current.name;
    const normalizedKey = normalizeKey(key || current.key || current.name);

    const duplicate = await TestCaseGroup.findOne({
      _id: { $ne: current._id },
      project: { $in: [nextProjectRef, nextProjectVersionId].filter(Boolean) },
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case group name or key already exists in this project');
    }

    return {
      project: nextProjectRef,
      projectVersionId: nextProjectVersionId,
      key: normalizedKey,
      name: normalizedName,
      description: description !== undefined ? description || '' : current.description,
      createdBy: current.createdBy,
    };
  });
};

const deleteTestCaseGroupService = async (groupId) => {
  await softDeleteVersionSeries(TestCaseGroup, groupId);
};

const restoreTestCaseGroupService = async (groupId) => {
  const current = await TestCaseGroup.findOne({ entityId: toObjectId(groupId, 'groupId') }).lean();
  if (!current) {
    throw httpError(404, 'Test case group not found');
  }

  const project = await ensureProjectExists(current.project, { includeDeleted: true });
  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectRefs = Array.from(
    new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));

  const duplicate = await TestCaseGroup.findOne({
    _id: { $ne: current._id },
    project: { $in: projectRefs },
    $and: [
      activeLatestFilter(),
      { $or: [{ key: current.key }, { name: current.name }] },
    ],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case group name or key already exists in this project');
  }

  await restoreVersionSeries(TestCaseGroup, groupId);
  return TestCaseGroup.findOne({ entityId: toObjectId(groupId, 'groupId') }).lean();
};

// Test case CRUD
const createTestCaseService = async ({
  projectId,
  groupId,
  caseKey,
  key,
  title,
  name,
  description,
  expected,
  steps,
  automation,
  priority,
  severity,
  type,
  createdBy,
}) => {

  if (!projectId || !groupId || !caseKey || !title) {
    throw httpError(400, 'projectId, groupId, caseKey and title are required');
  }

  const project = await ensureProjectExists(projectId);
  const group = await ensureGroupExists(groupId, project._id);
  const normalizedKey = normalizeKey(key || caseKey);
  const normalizedName = normalizeName(name || title);
  const normalizedAutomation = automation
    ? {
        enabled: Boolean(automation.enabled),
        runner: 'playwright',
        webId: String(automation.webId || '').trim(),
        baseUrl: String(automation.baseUrl || '').trim(),
        userKey: String(automation.userKey || '').trim(),
        timeoutMs: Number(automation.timeoutMs || 30000),
        steps: normalizeAutomationSteps(automation.steps),
      }
    : {
        enabled: false,
        runner: 'playwright',
        webId: '',
        baseUrl: '',
        userKey: '',
        timeoutMs: 30000,
        steps: [],
      };

  if (normalizedAutomation.enabled && normalizedAutomation.steps.length === 0) {
    throw httpError(400, 'automation.steps[] are required when automation is enabled');
  }

  const groupRef = group.entityId || group._id;

  const duplicate = await TestCase.findOne({
    group: toObjectId(groupRef, 'groupId'),
    deletedAt: null,
    isLatest: true,
    key: normalizedKey,
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case key already exists in this group', {
      conflict: await buildTestCaseConflict(duplicate, groupRef),
    });
  }

  const testCase = await TestCase.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    project: project.entityId ? project.entityId : project._id,
    projectVersionId: project._id,
    group: group.entityId ? group.entityId : group._id,
    groupVersionId: group._id,
    key: normalizedKey,
    name: normalizedName,
    caseKey: normalizedKey,
    title: normalizedName,
    description: description || '',
    expected: normalizeOverallExpected(expected),
    steps: normalizeManualSteps(steps),
    priority: priority || 'medium',
    severity: severity || 'major',
    type: type || 'functional',
    automation: normalizedAutomation,
    createdBy,
  });

  const createdDoc = await TestCase.findById(testCase._id).lean();

  let projectObj = null;
  if (createdDoc && createdDoc.project) {
    projectObj = await Project.findOne({
      $and: [
        { $or: [ { _id: createdDoc.project }, { entityId: createdDoc.project } ] },
        activeLatestFilter(),
      ],
    }).select('entityId name code deletedAt').lean();
  }

  let groupObj = null;
  if (createdDoc && createdDoc.group) {
    groupObj = await TestCaseGroup.findOne({
      $and: [
        { $or: [ { _id: createdDoc.group }, { entityId: createdDoc.group } ] },
        activeLatestFilter(),
      ],
    }).select('entityId name key deletedAt').lean();
  }

  const normalized = {
    ...createdDoc,
    project: projectObj || (createdDoc ? createdDoc.project : null),
    group: groupObj || (createdDoc ? createdDoc.group : null),
  };

  return normalized;
};

const listTestCasesService = async (query = {}) => {
  const { projectId, groupId, search, includeDeleted } = query;
  const baseFilters = {};

  if (projectId) {
    const project = await ensureProjectExists(projectId);
    try {
      const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
      // include both all version _ids and the entityId value so records that
      // mistakenly stored the project's entityId in the `project` field will match
      const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
      baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
    } catch (err) {
      baseFilters.project = project._id;
    }
  } else {
    const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
    baseFilters.project = { $in: activeProjectIds };
  }

  if (groupId) {
    if (query.projectId) {
      // project scope exists; resolve group within that project
      const project = await ensureProjectExists(query.projectId);
      const resolvedGroup = await ensureGroupExists(groupId, project._id);
      const groupVersionIds = await TestCaseGroup.find({
        entityId: resolvedGroup.entityId || resolvedGroup._id,
      }).distinct('_id');
      const groupRefs = Array.from(
        new Set(
          [
            ...(groupVersionIds || []),
            resolvedGroup.entityId,
            resolvedGroup._id,
          ]
            .filter(Boolean)
            .map((value) => String(value)),
        ),
      ).map((value) => toObjectId(value, 'groupId'));
      baseFilters.group = { $in: groupRefs };
    } else {
      // no project scope provided — resolve group globally by entityId or _id
      let resolvedGroup = await TestCaseGroup.findOne({
        entityId: toObjectId(groupId, 'groupId'),
        $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
        deletedAt: null,
      }).lean();
      if (!resolvedGroup) {
        resolvedGroup = await TestCaseGroup.findOne({ _id: toObjectId(groupId, 'groupId'), deletedAt: null }).lean();
      }
      if (!resolvedGroup) {
        throw httpError(404, 'Group not found');
      }
      const groupVersionIds = await TestCaseGroup.find({
        entityId: resolvedGroup.entityId || resolvedGroup._id,
      }).distinct('_id');
      const groupRefs = Array.from(
        new Set(
          [
            ...(groupVersionIds || []),
            resolvedGroup.entityId,
            resolvedGroup._id,
          ]
            .filter(Boolean)
            .map((value) => String(value)),
        ),
      ).map((value) => toObjectId(value, 'groupId'));
      baseFilters.group = { $in: groupRefs };
    }
  }

  const { docs: testCases, pagination } = await buildVersionedList({
    model: TestCase,
    query,
    search,
    searchFields: ['key', 'name', 'caseKey', 'title', 'description'],
    baseFilters,
    // do not populate project/group here — we need the raw stored reference values
    // so that we can resolve both _id and entityId cases consistently below
    populate: [],
    includeDeleted: includeDeleted === 'true',
  });

  // ensure testCases whose `project` field contains an entityId (not a project _id)
  // still get their project object attached for frontend getId() semantics
  const referencedIds = Array.from(new Set(testCases.map((t) => extractReferenceId(t.project)).filter(Boolean)));
  let attachedProjects = [];
  if (referencedIds.length > 0) {
    const referencedObjectIds = referencedIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
    attachedProjects = await Project.find({
      $or: [
        { _id: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
        { entityId: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
      ],
    }).select('entityId name code deletedAt').lean();
  }

  const projectMap = new Map();
  for (const p of attachedProjects) {
    projectMap.set(String(p._id), p);
    if (p.entityId) projectMap.set(String(p.entityId), p);
  }

  const referencedGroupIds = Array.from(new Set(testCases.map((t) => extractReferenceId(t.group)).filter(Boolean)));
  let attachedGroups = [];
  if (referencedGroupIds.length > 0) {
    const referencedGroupObjectIds = referencedGroupIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
    attachedGroups = await TestCaseGroup.find({
      $or: [
        { _id: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
        { entityId: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
      ],
    }).select('entityId name key deletedAt').lean();
  }

  const groupMap = new Map();
  for (const group of attachedGroups) {
    groupMap.set(String(group._id), group);
    if (group.entityId) groupMap.set(String(group.entityId), group);
  }

  const normalizedTestCases = [];
  for (const t of testCases) {
    const refProjId = extractReferenceId(t.project);
    let proj = projectMap.get(refProjId) || t.project || null;
    if ((!proj || typeof proj !== 'object') && refProjId) {
      // fallback: try to resolve active/latest project per-item
      const found = await Project.findOne({
        $and: [
          { $or: [ { _id: refProjId }, { entityId: refProjId } ] },
          activeLatestFilter(),
        ],
      }).select('entityId name code deletedAt').lean();
      if (found) proj = found;
    }

    const refGroupId = extractReferenceId(t.group);
    let grp = groupMap.get(refGroupId) || t.group || null;
    if ((!grp || typeof grp !== 'object') && refGroupId) {
      // fallback: try to resolve active/latest group per-item
      const foundG = await TestCaseGroup.findOne({
        $and: [
          { $or: [ { _id: refGroupId }, { entityId: refGroupId } ] },
          activeLatestFilter(),
        ],
      }).select('entityId name key deletedAt').lean();
      if (foundG) grp = foundG;
    }

    normalizedTestCases.push({
      ...t,
      project: proj || null,
      group: grp || null,
    });
  }

  return { testCases: normalizedTestCases, pagination };
};

const listTestCaseDetailsService = async (query = {}) => {
  const { projectId, groupId, search } = query;

  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const project = await ensureProjectExists(projectId);
  // match test cases referencing any project version _id or the project's entityId
  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
  const projectObjectIds = projectIds.map((v) => toObjectId(v, 'projectId'));

  const filters = [
    { project: { $in: projectObjectIds } },
    { deletedAt: null },
  ];
  let resolvedGroup = null;
  if (groupId) {
    // Resolve provided groupId (could be entityId or version _id) to all
    // group references in this project, then filter test cases by `group`.
    // This ensures the frontend may send either the group's entityId or a
    // version _id and still match.
    const groupObjectId = toObjectId(groupId, 'groupId');

    // include all versions for the group entity (do not restrict to isLatest)
    const groupVersionIds = await TestCaseGroup.find({
      $and: [
        { $or: [{ entityId: groupObjectId }, { _id: groupObjectId }] },
        { project: { $in: projectObjectIds } },
      ],
    }).distinct('_id');

    resolvedGroup = await TestCaseGroup.findOne({
      $and: [
        { $or: [{ entityId: groupObjectId }, { _id: groupObjectId }] },
        { project: { $in: projectObjectIds } },
        activeLatestFilter(),
      ],
    }).select('entityId name key deletedAt').lean();

    if (!resolvedGroup && groupVersionIds.length > 0) {
      resolvedGroup = await TestCaseGroup.findOne({
        _id: { $in: groupVersionIds.map((v) => toObjectId(v, 'groupId')) },
      }).select('entityId name key deletedAt').lean();
    }

    if (!groupVersionIds || groupVersionIds.length === 0) {
      return { testCases: [], pagination: null };
    }

    const groupRefs = Array.from(
      new Set(
        [
          ...groupVersionIds.map((value) => String(value)),
          String(groupObjectId),
          resolvedGroup?.entityId ? String(resolvedGroup.entityId) : '',
        ].filter(Boolean),
      ),
    );
    const groupRefObjectIds = groupRefs
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => toObjectId(value, 'groupId'));

    if (groupRefObjectIds.length === 0) {
      return { testCases: [], pagination: null };
    }

    // Filter test cases by their group reference directly.
    // This is more stable than deriving membership from run results.
    filters.push({ group: { $in: groupRefObjectIds } });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['key', 'name', 'caseKey', 'title', 'description']));
  }

  const match = filters.length === 1 ? filters[0] : { $and: filters };

  const testCases = await TestCase.find(match)
    .sort({ createdAt: -1 })
    .populate('group', 'entityId name key deletedAt')
    .lean();

  if (testCases.length === 0) {
    return { testCases: [] };
  }

  const entityIds = testCases
    .map((testCase) => testCase.entityId)
    .filter(Boolean);

  const allCaseVersions = await TestCase.find({
    project: { $in: projectObjectIds },
    entityId: { $in: entityIds },
  })
    .select('_id entityId')
    .lean();

  const versionIdToEntityId = new Map(
    allCaseVersions.map((row) => [objectIdString(row._id), objectIdString(row.entityId)]),
  );
  const entityIdToVersionIds = allCaseVersions.reduce((acc, row) => {
    const entityId = objectIdString(row.entityId);
    const versionId = objectIdString(row._id);
    if (!entityId || !versionId) {
      return acc;
    }
    const existing = acc.get(entityId) || new Set();
    existing.add(versionId);
    acc.set(entityId, existing);
    return acc;
  }, new Map());
  const versionIds = allCaseVersions.map((row) => row._id);

  let historyByEntity = new Map();
  if (versionIds.length > 0) {
    const historyRuns = await TestRun.find({
      project: { $in: projectObjectIds },
    })
      .select('name status startedAt endedAt startedBy endedBy results')
      .populate('startedBy', 'name email role')
      .populate('endedBy', 'name email role')
      .lean();

    const referencedGroupIds = Array.from(new Set(
      historyRuns.flatMap((run) => (run.results || []).map((result) => objectIdString(result.group)).filter(Boolean)),
    ));
    const referencedGroupObjectIds = referencedGroupIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
    const referencedGroups = referencedGroupObjectIds.length > 0
      ? await TestCaseGroup.find({
          $or: [
            { _id: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
            { entityId: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
          ],
        }).select('entityId name key deletedAt').lean()
      : [];

    const groupMap = new Map();
    for (const group of referencedGroups) {
      groupMap.set(String(group._id), group);
      if (group.entityId) groupMap.set(String(group.entityId), group);
    }

    historyByEntity = historyRuns.reduce((acc, run) => {
      const runStartedAt = run.startedAt || run.createdAt || null;

      (run.results || [])
        .filter((result) => ['pass', 'fail', 'blocked', 'skip'].includes(result.status) && result.testCase)
        .sort((left, right) => {
          const leftTime = new Date(left.executedAt || runStartedAt || 0).getTime();
          const rightTime = new Date(right.executedAt || runStartedAt || 0).getTime();
          return rightTime - leftTime;
        })
        .forEach((result) => {
          const testCaseRef = objectIdString(result.testCase);
          if (!testCaseRef) {
            return;
          }
          const mappedEntityId = versionIdToEntityId.get(testCaseRef);
          const targetVersionIds = versionIdToEntityId.has(testCaseRef)
            ? [testCaseRef]
            : Array.from(entityIdToVersionIds.get(testCaseRef) || []);
          if (!mappedEntityId && targetVersionIds.length === 0) {
            return;
          }

          const resultGroup = result.group ? (groupMap.get(objectIdString(result.group)) || null) : null;
          const versionKeys = targetVersionIds.length > 0
            ? targetVersionIds
            : Array.from(entityIdToVersionIds.get(mappedEntityId) || []);
          for (const versionKey of versionKeys) {
            const existing = acc.get(versionKey) || [];
            existing.push({
              runId: String(run._id),
              runName: run.name,
              runStatus: run.status,
              status: result.status,
              executedAt: result.executedAt || runStartedAt,
              startedAt: run.startedAt || run.createdAt || null,
              endedAt: run.endedAt || null,
              startedBy: run.startedBy || null,
              endedBy: run.endedBy || null,
              group: resultGroup,
              note: result.note || result.notes || '',
            });
            acc.set(versionKey, existing);
          }
        });

      return acc;
    }, new Map());
  }

  const detailRows = testCases.map((testCase) => ({
    ...testCase,
    group: (historyByEntity.get(objectIdString(testCase._id)) || [])[0]?.group || resolvedGroup || testCase.group || null,
    recentStatuses: (historyByEntity.get(objectIdString(testCase._id)) || []).slice(0, 3).map((entry) => entry.status),
    executionHistory: historyByEntity.get(objectIdString(testCase._id)) || [],
  }));

  return { testCases: detailRows };
};

const getTestCaseService = async (testCaseId) => {
  const testCase = await TestCase.findOne({
    entityId: toObjectId(testCaseId, 'testCaseId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  })
    .populate('project', 'entityId name code deletedAt')
    .populate('group', 'name key deletedAt')
    .lean();
  if (!testCase) {
    return null;
  }

  return testCase;
};

const getTestCaseVersionsService = async (testCaseId) => {
  try {
    const versions = await getVersionHistory(TestCase, testCaseId);
    return versions;
  } catch (err) {
    // If entity not found, return empty versions list instead of 404
    return [];
  }
};

const updateTestCaseService = async (testCaseId, payload = {}) => {
  const {
    projectId,
    groupId,
    caseKey,
    key,
    title,
    name,
    description,
    expected,
    steps,
    automation,
    priority,
    severity,
    type,
    status,
  } = payload;

  const currentCaseId = toObjectId(testCaseId, 'testCaseId');
  const currentCase = await TestCase.findOne({
    $or: [
      { entityId: currentCaseId },
      { _id: currentCaseId },
    ],
  }).lean();
  if (!currentCase) {
    throw httpError(404, 'Test case not found');
  }

  const currentCaseRefs = [currentCase.entityId || currentCase._id, currentCase._id].filter(Boolean);

  const updated = await updateVersionedDocument(TestCase, testCaseId, async (current) => {
    const requestedProjectRef = projectId ? toObjectId(projectId, 'projectId') : current.project;
    const requestedGroupRef = groupId ? toObjectId(groupId, 'groupId') : current.group;

    // Resolve project and group documents (get the project version _id)
    const resolvedProject = await ensureProjectExists(requestedProjectRef, { includeDeleted: false });
    const resolvedGroup = await ensureGroupExists(requestedGroupRef, resolvedProject._id, { includeDeleted: false });

    // Choose what to store on the TestCase.project / TestCase.group fields:
    // prefer storing the project's/group's entityId (stable across versions) when available,
    // otherwise fall back to the document _id. This keeps create/update consistent.
    const storeProjectRef = resolvedProject.entityId ? resolvedProject.entityId : resolvedProject._id;
    const storeGroupRef = resolvedGroup.entityId ? resolvedGroup.entityId : resolvedGroup._id;
    const groupRef = resolvedGroup.entityId || resolvedGroup._id;

    const normalizedKey = normalizeKey(key || caseKey || current.key || current.caseKey);
    const normalizedName = normalizeName(name || title || current.name || current.title);

    const duplicate = await TestCase.findOne({
      _id: { $ne: current._id },
      group: toObjectId(groupRef, 'groupId'),
      deletedAt: null,
      isLatest: true,
      key: normalizedKey,
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case key already exists in this group', {
        conflict: await buildTestCaseConflict(duplicate, groupRef),
      });
    }

    const nextExpected = expected !== undefined
      ? normalizeOverallExpected(expected)
      : normalizeOverallExpected(current.expected);

    const nextSteps = Array.isArray(steps)
      ? normalizeManualSteps(steps)
      : current.steps;

    const nextAutomation = automation
      ? {
          enabled: Boolean(automation.enabled),
          runner: 'playwright',
          webId: String(automation.webId || '').trim(),
          baseUrl: String(automation.baseUrl || '').trim(),
          userKey: String(automation.userKey || '').trim(),
          timeoutMs: Number(automation.timeoutMs || 30000),
          steps: normalizeAutomationSteps(automation.steps),
        }
      : current.automation || {
          enabled: false,
          runner: 'playwright',
          webId: '',
          baseUrl: '',
          userKey: '',
          timeoutMs: 30000,
          steps: [],
        };

    if (nextAutomation.enabled && nextAutomation.steps.length === 0) {
      throw httpError(400, 'automation.steps[] are required when automation is enabled');
    }

    return {
      project: storeProjectRef,
      projectVersionId: resolvedProject._id,
      group: storeGroupRef,
      groupVersionId: resolvedGroup._id,
      key: normalizedKey,
      name: normalizedName,
      caseKey: normalizedKey,
      title: normalizedName,
      description: description !== undefined ? description || '' : current.description,
      expected: nextExpected,
      steps: nextSteps,
      priority: priority || current.priority,
      severity: severity || current.severity,
      type: type || current.type,
      status: status && ['active', 'deprecated'].includes(status) ? status : current.status,
      automation: nextAutomation,
      createdBy: current.createdBy,
    };
  });

  await TestPlan.updateMany(
    {
      deletedAt: null,
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      'items.testCase': { $in: currentCaseRefs },
    },
    {
      $set: {
        'items.$[item].testCase': updated.entityId || updated._id,
        'items.$[item].testCaseVersionId': updated._id,
      },
    },
    {
      arrayFilters: [
        {
          'item.testCase': { $in: currentCaseRefs },
        },
      ],
    },
  );

  // Load the updated doc and attach project/group objects whether the TestCase stores
  // a project/group _id or the project's/group's entityId.
  const updatedDoc = await TestCase.findById(updated._id).lean();

  let projectObj = null;
  if (updatedDoc && updatedDoc.project) {
    projectObj = await Project.findOne({
      $and: [
        { $or: [ { _id: updatedDoc.project }, { entityId: updatedDoc.project } ] },
        activeLatestFilter(),
      ],
    }).select('entityId name code deletedAt').lean();
  }

  let groupObj = null;
  if (updatedDoc && updatedDoc.group) {
    groupObj = await TestCaseGroup.findOne({
      $and: [
        { $or: [ { _id: updatedDoc.group }, { entityId: updatedDoc.group } ] },
        activeLatestFilter(),
      ],
    }).select('entityId name key deletedAt').lean();
  }

  const normalized = {
    ...updatedDoc,
    project: projectObj || (updatedDoc ? updatedDoc.project : null),
    group: groupObj || (updatedDoc ? updatedDoc.group : null),
  };

  return normalized;
};

const importTestCasesService = async ({ file, body = {}, userId }) => {
  if (!file) {
    throw httpError(400, 'File is required');
  }

  const { projectId } = body;
  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const project = await ensureProjectExists(projectId);
  const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);

  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      throw httpError(400, 'Excel sheet is empty or invalid');
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const rowGroupKey = String(row['Group Key'] || '').trim();
        const rowGroupName = String(row['Group Name'] || row['Group'] || '').trim();
        const caseKey = String(row['Case Key'] || '').trim();
        const title = String(row['Title'] || '').trim();
        const description = String(row['Description'] || '').trim();
        const priority = String(row['Priority'] || 'medium').trim().toLowerCase();
        const severity = String(row['Severity'] || 'major').trim().toLowerCase();
        const type = String(row['Type'] || 'functional').trim().toLowerCase();

        if (!rowGroupKey && !rowGroupName) {
          errors.push({
            row: i + 2,
            error: 'Group Key or Group Name is required',
          });
          continue;
        }

        if (!caseKey || !title) {
          errors.push({
            row: i + 2,
            error: 'Case Key and Title are required',
          });
          continue;
        }

        const groupQuery = {
          project: { $in: projectRefs.map((value) => toObjectId(value, 'projectId')) },
          deletedAt: null,
          isLatest: true,
        };

        if (rowGroupKey) {
          groupQuery.key = normalizeKey(rowGroupKey);
        } else {
          groupQuery.name = normalizeName(rowGroupName);
        }

        const group = await TestCaseGroup.findOne(groupQuery).lean();
        if (!group) {
          errors.push({
            row: i + 2,
            error: `Test case group '${rowGroupKey || rowGroupName}' not found in selected project`,
          });
          continue;
        }

        const expectedResult = String(row['Expected Result'] || '').trim();
        if (!expectedResult) {
          errors.push({
            row: i + 2,
            error: 'Expected Result is required',
          });
          continue;
        }

        // detect dynamic step action columns like "Step 1 Action", "Step 6 Action", etc.
        const stepPattern = /^Step\s*(\d+)\s*Action$/i;
        const detectedSteps = Object.keys(row)
          .map((key) => {
            const m = String(key).match(stepPattern);
            if (!m) return null;
            const idx = parseInt(m[1], 10);
            return { key, idx };
          })
          .filter(Boolean)
          .sort((a, b) => a.idx - b.idx);

        const stepExpectedPattern = /^Step\s*(\d+)\s*Expected$/i;
        const stepExpectedByIndex = Object.keys(row).reduce((acc, key) => {
          const match = String(key).match(stepExpectedPattern);
          if (!match) {
            return acc;
          }

          const idx = parseInt(match[1], 10);
          acc[idx] = normalizeStepExpected(row[key]);
          return acc;
        }, {});

        const steps = [];
        for (const s of detectedSteps) {
          const action = String(row[s.key] || '').trim();
          if (action) {
            steps.push({
              order: s.idx,
              action,
              expected: stepExpectedByIndex[s.idx] ?? null,
            });
          }
        }

        if (steps.length === 0) {
          errors.push({ row: i + 2, error: 'At least one step action is required' });
          continue;
        }

        const normalizedKey = normalizeKey(caseKey);
        const normalizedName = normalizeName(title);

        const groupRef = group.entityId || group._id;

        const duplicate = await TestCase.findOne({
          group: toObjectId(groupRef, 'groupId'),
          deletedAt: null,
          isLatest: true,
          key: normalizedKey,
        }).lean();
        if (duplicate) {
          errors.push({
            row: i + 2,
            error: `Test case '${normalizedKey}' already exists in group '${group.name}'`,
            conflict: await buildTestCaseConflict(duplicate, groupRef),
          });
          continue;
        }

        // validation for priority/severity/type may be strict based on flag
        const strict = String(body.strict || '').toLowerCase() === 'true';

        if (strict) {
          if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
            errors.push({ row: i + 2, error: `Invalid priority '${priority}'` });
            continue;
          }
          if (!['minor', 'major', 'critical'].includes(severity)) {
            errors.push({ row: i + 2, error: `Invalid severity '${severity}'` });
            continue;
          }
          if (!['functional', 'api', 'ui', 'regression', 'security', 'other'].includes(type)) {
            errors.push({ row: i + 2, error: `Invalid type '${type}'` });
            continue;
          }
        }

        const testCase = await TestCase.create({
          entityId: createEntityId(),
          versionNumber: 1,
          isLatest: true,
          deletedAt: null,
          project: project.entityId ? project.entityId : project._id,
          projectVersionId: project._id,
          group: group.entityId ? group.entityId : group._id,
          groupVersionId: group._id,
          key: normalizedKey,
          name: normalizedName,
          caseKey: normalizedKey,
          title: normalizedName,
          description,
          expected: expectedResult,
          steps,
          priority: ['low', 'medium', 'high', 'critical'].includes(priority)
            ? priority
            : 'medium',
          severity: ['minor', 'major', 'critical'].includes(severity)
            ? severity
            : 'major',
          type: ['functional', 'api', 'ui', 'regression', 'security', 'other'].includes(type)
            ? type
            : 'functional',
          status: 'active',
          createdBy: userId,
        });

        created.push({
          _id: testCase._id,
          caseKey: testCase.caseKey,
          title: testCase.title,
        });
      } catch (rowErr) {
        errors.push({
          row: i + 2,
          error: String(rowErr?.message || 'Unknown error'),
        });
      }
    }

    return {
      message: `Imported ${created.length} test cases`,
      created,
      errors,
      total: rows.length,
    };
  } catch (err) {
    throw httpError(400, `Excel parsing error: ${err.message}`);
  }
};
const deleteTestCaseService = async (testCaseId) => {
  await softDeleteVersionSeries(TestCase, testCaseId);
};

const restoreTestCaseService = async (testCaseId) => {
  const current = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId') }).lean();
  if (!current) {
    throw httpError(404, 'Test case not found');
  }

  const project = await ensureProjectExists(current.project, { includeDeleted: true });
  const group = await TestCaseGroup.findOne({
    $or: [
      { entityId: current.group },
      { _id: current.group },
    ],
  }).lean();
  if (!group) {
    throw httpError(404, 'Test case group not found');
  }

  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectRefs = Array.from(
    new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));

  const groupVersionIds = await TestCaseGroup.find({ entityId: group.entityId }).distinct('_id');
  const groupRefs = Array.from(
    new Set([...(groupVersionIds || []), group.entityId, group._id].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'groupId'));

  const duplicate = await TestCase.findOne({
    _id: { $ne: current._id },
    project: { $in: projectRefs },
    group: { $in: groupRefs },
    $and: [
      activeLatestFilter(),
      { key: current.key },
    ],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case key already exists in this group');
  }

  await restoreVersionSeries(TestCase, testCaseId);
  const testCase = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId') })
    .populate('project', 'entityId name code deletedAt')
    .populate('group', 'name key deletedAt')
    .lean();
  return testCase;
};

// Test plan CRUD
const createTestPlanService = async ({
  name,
  key,
  description,
  projectId,
  versionId,
  caseIds,
  executionMode,
  ownerId,
  assigneeIds,
  createdBy,
}) => {
  if (!name || !projectId || !versionId || !Array.isArray(caseIds) || caseIds.length === 0) {
    throw httpError(400, 'name, projectId, versionId and caseIds[] are required');
  }

  const project = await ensureProjectExists(projectId);
  const releaseVersion = await ensureVersionExists(versionId, project._id);
  const normalizedKey = normalizeKey(key || name);
  const normalizedName = normalizeName(name);
  const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);
  const versionRefs = [String(releaseVersion._id), String(releaseVersion.entityId || '')].filter(Boolean);

  const duplicate = await TestPlan.findOne({
    project: { $in: projectRefs },
    version: { $in: versionRefs },
    deletedAt: null,
    isLatest: true,
    $or: [{ key: normalizedKey }, { name: normalizedName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test plan name or key already exists in this release version');
  }

  const allowedProjectRefs = new Set(projectRefs);
  const validCaseIds = [];
  for (let index = 0; index < caseIds.length; index += 1) {
    const testCase = await resolveTestCaseByReference(caseIds[index], { includeDeleted: false });
    if (!testCase) {
      throw httpError(400, 'Some caseIds do not exist in selected project');
    }

    const caseProjectRef = extractReferenceId(testCase.project);
    if (!allowedProjectRefs.has(String(caseProjectRef))) {
      throw httpError(400, 'Some caseIds do not exist in selected project');
    }

    validCaseIds.push({
      testCase: testCase.entityId || testCase._id,
      testCaseVersionId: testCase._id,
      order: index + 1,
      owner: ownerId ? toObjectId(ownerId, 'ownerId') : undefined,
      assignees: Array.isArray(assigneeIds)
        ? assigneeIds.map((id, assigneeIndex) => toObjectId(id, `assigneeIds[${assigneeIndex}]`))
        : [],
    });
  }

  const testPlan = await TestPlan.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    key: normalizedKey,
    name: normalizedName,
    description: description || '',
    project: project.entityId ? project.entityId : project._id,
    projectVersionId: project._id,
    version: releaseVersion.entityId ? releaseVersion.entityId : releaseVersion._id,
    versionVersionId: releaseVersion._id,
    createdBy,
    owner: ownerId ? toObjectId(ownerId, 'ownerId') : undefined,
    assignees: Array.isArray(assigneeIds)
      ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
      : [],
    executionMode: executionMode === 'automation' ? 'automation' : 'manual',
    items: validCaseIds,
  });

  const normalizedPlan = await attachTestPlanCases(
    await TestPlan.findById(testPlan._id)
      .populate('project', 'entityId name code deletedAt')
      .populate('version', 'entityId name deletedAt')
      .populate('owner', 'name email role')
      .populate('assignees', 'name email role')
      .lean(),
  );

  return normalizedPlan;
};

const listTestPlansService = async (query = {}, user = null) => {
  const {
    projectId, versionId, search, includeDeleted,
  } = query;
  const baseFilters = {};
  let resolvedProject = null;

  if (projectId) {
    try {
      resolvedProject = await ensureProjectExists(projectId);
    } catch (error) {
      if (error.statusCode === 404) {
        return { testPlans: [], pagination: null };
      }
      throw error;
    }
  } else {
    const activeProjectRefs = await Project.find({ deletedAt: null }).select('_id entityId').lean();
    const activeProjectIds = Array.from(new Set(
      activeProjectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    baseFilters.project = { $in: activeProjectIds.map((v) => toObjectId(v, 'projectId')) };
  }

  if (resolvedProject) {
    const projectRefs = await Project.find({ entityId: resolvedProject.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
  }

  if (versionId) {
    let version;
    try {
      if (resolvedProject) {
        version = await ensureVersionExists(versionId, resolvedProject._id);
      } else {
        version = await Version.findOne({
          $or: [
            { entityId: toObjectId(versionId, 'versionId') },
            { _id: toObjectId(versionId, 'versionId') },
          ],
          ...activeLatestFilter(),
          deletedAt: null,
        }).lean();
        if (!version) {
          throw httpError(404, 'Version not found');
        }
      }
    } catch (error) {
      if (error.statusCode === 404) {
        return { testPlans: [], pagination: null };
      }
      throw error;
    }
    // allow version stored as entityId or document _id
    const versionRefs = [String(version._id)];
    if (version.entityId) versionRefs.push(String(version.entityId));
    baseFilters.version = { $in: versionRefs.map((v) => toObjectId(v, 'versionId')) };
  }
  const { docs: testPlans, pagination } = await buildVersionedList({
    model: TestPlan,
    query,
    search,
    searchFields: ['key', 'name', 'description'],
    baseFilters,
    // populate relations except project/version which we will attach manually
    populate: [
      { path: 'owner', select: 'name email role' },
      { path: 'assignees', select: 'name email role' },
    ],
    includeDeleted: includeDeleted === 'true',
  });

  // Attach project & version objects for plans whose project/version fields may store
  // either a project/version _id or the entityId. Use active/latest filter when possible.
  const referencedProjectIds = Array.from(new Set(testPlans.map((p) => extractReferenceId(p.project)).filter(Boolean)));
  let attachedProjects = [];
  if (referencedProjectIds.length > 0) {
    const referencedProjectObjectIds = referencedProjectIds.filter((v) => mongoose.Types.ObjectId.isValid(v));
    attachedProjects = await Project.find({
      $or: [
        { _id: { $in: referencedProjectObjectIds.map((v) => toObjectId(v, 'projectId')) } },
        { entityId: { $in: referencedProjectObjectIds.map((v) => toObjectId(v, 'projectId')) } },
      ],
    }).select('entityId name code deletedAt').lean();
  }
  const projectMap = new Map();
  for (const p of attachedProjects) {
    projectMap.set(String(p._id), p);
    if (p.entityId) projectMap.set(String(p.entityId), p);
  }

  const referencedVersionIds = Array.from(new Set(testPlans.map((p) => extractReferenceId(p.version)).filter(Boolean)));
  let attachedVersions = [];
  if (referencedVersionIds.length > 0) {
    const referencedVersionObjectIds = referencedVersionIds.filter((v) => mongoose.Types.ObjectId.isValid(v));
    attachedVersions = await Version.find({
      $or: [
        { _id: { $in: referencedVersionObjectIds.map((v) => toObjectId(v, 'versionId')) } },
        { entityId: { $in: referencedVersionObjectIds.map((v) => toObjectId(v, 'versionId')) } },
      ],
    }).select('entityId name deletedAt').lean();
  }
  const versionMap = new Map();
  for (const v of attachedVersions) {
    versionMap.set(String(v._id), v);
    if (v.entityId) versionMap.set(String(v.entityId), v);
  }

  const normalizedPlans = testPlans.map((plan) => ({
    ...plan,
    project: projectMap.get(extractReferenceId(plan.project)) || plan.project || null,
    version: versionMap.get(extractReferenceId(plan.version)) || plan.version || null,
  }));

  const attachedPlans = await Promise.all(normalizedPlans.map((plan) => attachTestPlanCases(plan)));

  const visiblePlans = user?.role === 'admin' || !user
    ? attachedPlans
    : attachedPlans.filter((plan) => isPlanAssignedToUser(plan, user.id));

  return { testPlans: visiblePlans, pagination };
};

const getTestPlanService = async (testPlanId) => {
  const testPlan = await TestPlan.findOne({
    entityId: toObjectId(testPlanId, 'testPlanId'),
    isLatest: true,
    deletedAt: null,
  })
    .populate('project', 'entityId name code deletedAt')
    .populate('version', 'entityId name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();
  if (!testPlan) {
    return null;
  }

  return attachTestPlanCases(testPlan);
};

const getTestPlanVersionsService = async (testPlanId) => {
  try {
    const versions = await getVersionHistory(TestPlan, testPlanId);
    return versions;
  } catch (err) {
    if (err?.statusCode === 404) {
      return [];
    }
    throw err;
  }
};

const assignTestPlanItemsService = async (testPlanId, { assigneeIds, ownerId }, userId) => {

  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    throw httpError(400, 'assigneeIds[] is required');
  }

  const nextTestPlan = await updateVersionedDocument(TestPlan, testPlanId, async (current) => ({
    key: current.key || normalizeKey(current.name || `PLAN-${String(current._id).slice(-6)}`),
    name: current.name || current.key || 'Untitled Test Plan',
    description: current.description,
    project: current.project,
    version: current.version,
    executionMode: current.executionMode,
    owner: ownerId ? toObjectId(ownerId, 'ownerId') : toObjectId(userId, 'ownerId'),
    assignees: assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`)),
    items: current.items,
    createdBy: current.createdBy || userId,
  }));

  const populated = await TestPlan.findById(nextTestPlan._id)
    .populate('project', 'entityId name code deletedAt')
    .populate('version', 'entityId name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  return attachTestPlanCases(populated);
};

const updateTestPlanService = async (
  testPlanId,
  {
    name,
    key,
    description,
    projectId,
    versionId,
    caseIds,
    executionMode,
    ownerId,
    assigneeIds,
  },
  userId,
) => {
  const nextTestPlan = await updateVersionedDocument(TestPlan, testPlanId, async (current) => {
    const nextProjectId = projectId ? toObjectId(projectId, 'projectId') : current.project;
    const nextVersionId = versionId ? toObjectId(versionId, 'versionId') : current.version;

    const project = await ensureProjectExists(nextProjectId, { includeDeleted: false });
    const version = await ensureVersionExists(nextVersionId, nextProjectId, { includeDeleted: false });
    const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);
    const versionRefs = [String(version._id), String(version.entityId || '')].filter(Boolean);

    const normalizedName = name ? normalizeName(name) : current.name;
    const normalizedKey = normalizeKey(key || current.key || current.name);

    const duplicate = await TestPlan.findOne({
      _id: { $ne: current._id },
      project: { $in: projectRefs },
      version: { $in: versionRefs },
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test plan name or key already exists in this release version');
    }

    const resolvedName = name ? normalizeName(name) : (current.name || current.key || 'Untitled Test Plan');
    const resolvedKey = normalizeKey(key || current.key || current.name || `PLAN-${String(current._id).slice(-6)}`);
    let items = current.items;
    if (Array.isArray(caseIds) && caseIds.length > 0) {
      items = [];
      const allowedProjectRefs = new Set([
        String(project._id),
        String(project.entityId || ''),
      ].filter(Boolean));
      for (let index = 0; index < caseIds.length; index += 1) {
        const testCase = await resolveTestCaseByReference(caseIds[index], { includeDeleted: false });
        if (!testCase) {
          throw httpError(400, 'Some caseIds do not exist in selected project');
        }

        const caseProjectRef = extractReferenceId(testCase.project);
        if (!allowedProjectRefs.has(String(caseProjectRef))) {
          throw httpError(400, 'Some caseIds do not exist in selected project');
        }

        items.push({
          testCase: testCase.entityId || testCase._id,
          testCaseVersionId: testCase._id,
          order: index + 1,
          owner: ownerId ? toObjectId(ownerId, 'ownerId') : current.owner,
          assignees: Array.isArray(assigneeIds)
            ? assigneeIds.map((id, assigneeIndex) => toObjectId(id, `assigneeIds[${assigneeIndex}]`))
            : current.assignees,
        });
      }
    }

    return {
      key: resolvedKey,
      name: resolvedName,
      description: description !== undefined ? description || '' : current.description,
      project: nextProjectId,
      projectVersionId: project._id,
      version: nextVersionId,
      versionVersionId: version._id,
      executionMode: executionMode && ['manual', 'automation'].includes(executionMode) ? executionMode : current.executionMode,
      owner: ownerId ? toObjectId(ownerId, 'ownerId') : current.owner,
      assignees: Array.isArray(assigneeIds)
        ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
        : current.assignees,
      items,
      createdBy: current.createdBy || userId,
    };
  });

  const populated = await TestPlan.findById(nextTestPlan._id)
    .populate('project', 'entityId name code deletedAt')
    .populate('version', 'entityId name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  return attachTestPlanCases(populated);
};

const deleteTestPlanService = async (testPlanId) => {
  await softDeleteVersionSeries(TestPlan, testPlanId);
};

const restoreTestPlanService = async (testPlanId) => {
  const current = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') }).lean();
  if (!current) {
    throw httpError(404, 'Test plan not found');
  }

  const project = await ensureProjectExists(current.project, { includeDeleted: true });
  const version = await ensureVersionExists(current.version, project._id, { includeDeleted: true });

  const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
  const projectRefs = Array.from(
    new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'projectId'));

  const versionVersionIds = await Version.find({ entityId: version.entityId }).distinct('_id');
  const versionRefs = Array.from(
    new Set([...(versionVersionIds || []), version.entityId, version._id].filter(Boolean).map((value) => String(value))),
  ).map((value) => toObjectId(value, 'versionId'));

  const duplicate = await TestPlan.findOne({
    _id: { $ne: current._id },
    project: { $in: projectRefs },
    version: { $in: versionRefs },
    $and: [
      activeLatestFilter(),
      { $or: [{ key: current.key }, { name: current.name }] },
    ],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test plan name or key already exists in this release version');
  }

  await restoreVersionSeries(TestPlan, testPlanId);
  const testPlan = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') })
    .populate('project', 'entityId name code deletedAt')
    .populate('version', 'entityId name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();
  return attachTestPlanCases(testPlan);
};

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
