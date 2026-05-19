const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { asyncHandler } = require('../utils/asyncHandler');
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
  const query = { _id: toObjectId(projectId, 'projectId') };
  if (!includeDeleted) {
    query.deletedAt = null;
  }

  const project = await Project.findOne(query).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  return project;
};

const ensureVersionExists = async (versionId, projectId, { includeDeleted = false } = {}) => {
  const query = {
    _id: toObjectId(versionId, 'versionId'),
    project: toObjectId(projectId, 'projectId'),
  };

  if (!includeDeleted) {
    query.deletedAt = null;
  }

  const version = await Version.findOne(query).lean();
  if (!version) {
    throw httpError(404, 'Version not found in selected project');
  }

  return version;
};

const ensureGroupExists = async (groupId, projectId, { includeDeleted = false } = {}) => {
  const query = {
    _id: toObjectId(groupId, 'groupId'),
    project: toObjectId(projectId, 'projectId'),
  };

  if (!includeDeleted) {
    query.$or = [{ isLatest: true }, { isLatest: { $exists: false } }];
    query.deletedAt = null;
  }

  const group = await TestCaseGroup.findOne(query).lean();
  if (!group) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  return group;
};

const ensureTestCaseExists = async (testCaseId, projectId, { includeDeleted = false } = {}) => {
  const query = {
    _id: toObjectId(testCaseId, 'testCaseId'),
    project: toObjectId(projectId, 'projectId'),
  };

  if (!includeDeleted) {
    query.$or = [{ isLatest: true }, { isLatest: { $exists: false } }];
    query.deletedAt = null;
  }

  const testCase = await TestCase.findOne(query).lean();
  if (!testCase) {
    throw httpError(404, 'Test case not found in selected project');
  }

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
  steps,
  priority,
  severity,
  type,
  status,
  createdBy,
}) => {
  const normalizedKey = normalizeKey(key || caseKey);
  const normalizedName = normalizeName(name || title);
  const normalizedSteps = Array.isArray(steps)
    ? steps
        .filter((step) => step && step.action && step.expected)
        .map((step, index) => ({
          order: index + 1,
          action: String(step.action),
          expected: String(step.expected),
        }))
    : [];

  return {
    project: toObjectId(projectId, 'projectId'),
    group: toObjectId(groupId, 'groupId'),
    key: normalizedKey,
    name: normalizedName,
    caseKey: normalizedKey,
    title: normalizedName,
    description: description || '',
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

const updateVersionedDocument = async (Model, currentId, buildNextPayload) => {
  const current = await Model.findById(toObjectId(currentId, 'entityId'));
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
  const current = await Model.findById(toObjectId(id, 'entityId')).lean();
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  const deletedAt = new Date();

  await Model.updateMany({ entityId }, { $set: { deletedAt } });
};

const restoreVersionSeries = async (Model, id) => {
  const current = await Model.findById(toObjectId(id, 'entityId')).lean();
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  await Model.updateMany({ entityId }, { $set: { deletedAt: null } });
};

const getVersionHistory = async (Model, id) => {
  const current = await Model.findById(toObjectId(id, 'entityId')).lean();
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  return Model.find({ entityId }).sort({ versionNumber: 1 }).lean();
};

const getCurrentVersionById = async (Model, id) => {
  const doc = await Model.findById(toObjectId(id, 'entityId')).lean();
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

// Project CRUD
const createProject = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    throw httpError(400, 'name and code are required');
  }

  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeKey(code);

  const existingProject = await Project.findOne({
    deletedAt: null,
    $or: [{ code: normalizedCode }, { name: normalizedName }],
  }).lean();
  if (existingProject) {
    throw httpError(409, 'Project name or code already exists');
  }

  const project = await Project.create({
    name: normalizedName,
    code: normalizedCode,
    description: description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ project });
});

const listProjects = asyncHandler(async (req, res) => {
  const { search, includeDeleted } = req.query;
  const filters = [];

  if (includeDeleted !== 'true') {
    filters.push({ deletedAt: null });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['name', 'code', 'description']));
  }

  const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
  const projects = await Project.find(match).sort({ createdAt: -1 }).lean();

  res.json({ projects });
});

const getProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(toObjectId(projectId, 'projectId')).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  res.json({ project });
});

const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, code, description, status } = req.body;

  const project = await Project.findById(toObjectId(projectId, 'projectId'));
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  if (project.deletedAt) {
    throw httpError(409, 'Restore the project before editing it');
  }

  const nextName = name ? normalizeName(name) : project.name;
  const nextCode = code ? normalizeKey(code) : project.code;

  const duplicate = await Project.findOne({
    _id: { $ne: project._id },
    deletedAt: null,
    $or: [{ code: nextCode }, { name: nextName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Project name or code already exists');
  }

  if (name) project.name = nextName;
  if (code) project.code = nextCode;
  if (description !== undefined) project.description = description || '';
  if (status && ['active', 'archived'].includes(status)) project.status = status;

  await project.save();
  res.json({ project });
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(toObjectId(projectId, 'projectId'));
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  if (!project.deletedAt) {
    project.deletedAt = new Date();
    await project.save();
  }

  res.status(204).send();
});

const restoreProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(toObjectId(projectId, 'projectId'));
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const duplicate = await Project.findOne({
    _id: { $ne: project._id },
    deletedAt: null,
    $or: [{ code: project.code }, { name: project.name }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Another active project already uses the same name or code');
  }

  project.deletedAt = null;
  await project.save();
  res.json({ project });
});

// Release version CRUD
const createVersion = asyncHandler(async (req, res) => {
  const { projectId, name, releaseDate, notes } = req.body;
  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await ensureProjectExists(projectId);
  const normalizedName = normalizeName(name);

  const existingVersion = await Version.findOne({
    project: project._id,
    name: normalizedName,
    deletedAt: null,
  }).lean();
  if (existingVersion) {
    throw httpError(409, `Version "${name}" already exists in this project`);
  }

  const version = await Version.create({
    project: project._id,
    name: normalizedName,
    releaseDate,
    notes: notes || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ version });
});

const listVersions = asyncHandler(async (req, res) => {
  const { projectId, search, includeDeleted } = req.query;
  const filters = [];

  if (projectId) {
    filters.push({ project: toObjectId(projectId, 'projectId') });
  } else {
    const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
    filters.push({ project: { $in: activeProjectIds } });
  }

  if (includeDeleted !== 'true') {
    filters.push({ deletedAt: null });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['name', 'notes']));
  }

  const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
  const versions = await Version.find(match).sort({ createdAt: -1 }).lean();

  res.json({ versions });
});

const getVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const version = await Version.findById(toObjectId(versionId, 'versionId')).lean();
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  res.json({ version });
});

const updateVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const { name, releaseDate, notes } = req.body;

  const version = await Version.findById(toObjectId(versionId, 'versionId'));
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  if (version.deletedAt) {
    throw httpError(409, 'Restore the version before editing it');
  }

  if (name) version.name = normalizeName(name);
  if (releaseDate !== undefined) version.releaseDate = releaseDate || null;
  if (notes !== undefined) version.notes = notes || '';

  const duplicate = await Version.findOne({
    _id: { $ne: version._id },
    project: version.project,
    name: version.name,
    deletedAt: null,
  }).lean();
  if (duplicate) {
    throw httpError(409, `Version "${version.name}" already exists in this project`);
  }

  await version.save();
  res.json({ version });
});

const deleteVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const version = await Version.findById(toObjectId(versionId, 'versionId'));
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  version.deletedAt = new Date();
  await version.save();
  res.status(204).send();
});

const restoreVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const version = await Version.findById(toObjectId(versionId, 'versionId'));
  if (!version) {
    throw httpError(404, 'Version not found');
  }

  const duplicate = await Version.findOne({
    _id: { $ne: version._id },
    project: version.project,
    name: version.name,
    deletedAt: null,
  }).lean();
  if (duplicate) {
    throw httpError(409, `Version "${version.name}" already exists in this project`);
  }

  version.deletedAt = null;
  await version.save();
  res.json({ version });
});

// Test case group CRUD
const createTestCaseGroup = asyncHandler(async (req, res) => {
  const { projectId, name, key, description } = req.body;

  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await ensureProjectExists(projectId);
  const normalizedName = normalizeName(name);
  const normalizedKey = normalizeKey(key || name);

  const duplicate = await TestCaseGroup.findOne({
    project: project._id,
    deletedAt: null,
    isLatest: true,
    $or: [{ key: normalizedKey }, { name: normalizedName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case group name or key already exists in this project');
  }

  const group = await TestCaseGroup.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    project: project._id,
    key: normalizedKey,
    name: normalizedName,
    description: description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ group });
});

const listTestCaseGroups = asyncHandler(async (req, res) => {
  const { projectId, search, includeDeleted } = req.query;
  const baseFilters = {};

  if (projectId) {
    baseFilters.project = toObjectId(projectId, 'projectId');
  } else {
    const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
    baseFilters.project = { $in: activeProjectIds };
  }

  const { docs: groups, pagination } = await buildVersionedList({
    model: TestCaseGroup,
    query: req.query,
    search,
    searchFields: ['key', 'name', 'description'],
    baseFilters,
    populate: [{ path: 'project', select: 'name code deletedAt' }],
    includeDeleted: includeDeleted === 'true',
  });

  res.json({ groups, pagination });
});

const getTestCaseGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const group = await TestCaseGroup.findById(toObjectId(groupId, 'groupId'))
    .populate('project', 'name code deletedAt')
    .lean();
  if (!group) {
    throw httpError(404, 'Test case group not found');
  }

  res.json({ group });
});

const getTestCaseGroupVersions = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const versions = await getVersionHistory(TestCaseGroup, groupId);
  res.json({ versions });
});

const updateTestCaseGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { projectId, key, name, description } = req.body;

  const nextGroup = await updateVersionedDocument(TestCaseGroup, groupId, async (current) => {
    const nextProjectId = projectId ? toObjectId(projectId, 'projectId') : current.project;
    await ensureProjectExists(nextProjectId, { includeDeleted: false });

    const normalizedName = name ? normalizeName(name) : current.name;
    const normalizedKey = normalizeKey(key || current.key || current.name);

    const duplicate = await TestCaseGroup.findOne({
      _id: { $ne: current._id },
      project: nextProjectId,
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case group name or key already exists in this project');
    }

    return {
      project: nextProjectId,
      key: normalizedKey,
      name: normalizedName,
      description: description !== undefined ? description || '' : current.description,
      createdBy: current.createdBy,
    };
  });

  res.json({ group: nextGroup });
});

const deleteTestCaseGroup = asyncHandler(async (req, res) => {
  await softDeleteVersionSeries(TestCaseGroup, req.params.groupId);
  res.status(204).send();
});

const restoreTestCaseGroup = asyncHandler(async (req, res) => {
  await restoreVersionSeries(TestCaseGroup, req.params.groupId);
  const group = await TestCaseGroup.findById(toObjectId(req.params.groupId, 'groupId')).lean();
  res.json({ group });
});

// Test case CRUD
const createTestCase = asyncHandler(async (req, res) => {
  const { projectId, groupId, caseKey, key, title, name, description, steps, priority, severity, type } = req.body;

  if (!projectId || !groupId || !caseKey || !title) {
    throw httpError(400, 'projectId, groupId, caseKey and title are required');
  }

  const project = await ensureProjectExists(projectId);
  const group = await ensureGroupExists(groupId, project._id);
  const normalizedKey = normalizeKey(key || caseKey);
  const normalizedName = normalizeName(name || title);

  const duplicate = await TestCase.findOne({
    project: project._id,
    group: group._id,
    deletedAt: null,
    isLatest: true,
    $or: [{ key: normalizedKey }, { name: normalizedName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test case key or name already exists in this group');
  }

  const testCase = await TestCase.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    project: project._id,
    group: group._id,
    key: normalizedKey,
    name: normalizedName,
    caseKey: normalizedKey,
    title: normalizedName,
    description: description || '',
    steps: Array.isArray(steps)
      ? steps
          .filter((step) => step && step.action && step.expected)
          .map((step, index) => ({
            order: index + 1,
            action: String(step.action),
            expected: String(step.expected),
          }))
      : [],
    priority: priority || 'medium',
    severity: severity || 'major',
    type: type || 'functional',
    createdBy: req.user.id,
  });

  res.status(201).json({ testCase });
});

const listTestCases = asyncHandler(async (req, res) => {
  const { projectId, groupId, search, includeDeleted } = req.query;
  const baseFilters = {};

  if (projectId) {
    baseFilters.project = toObjectId(projectId, 'projectId');
  } else {
    const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
    baseFilters.project = { $in: activeProjectIds };
  }

  if (groupId) {
    baseFilters.group = toObjectId(groupId, 'groupId');
  }

  const { docs: testCases, pagination } = await buildVersionedList({
    model: TestCase,
    query: req.query,
    search,
    searchFields: ['key', 'name', 'caseKey', 'title', 'description'],
    baseFilters,
    populate: [
      { path: 'project', select: 'name code deletedAt' },
      { path: 'group', select: 'name key deletedAt' },
    ],
    includeDeleted: includeDeleted === 'true',
  });

  res.json({ testCases, pagination });
});

const listTestCaseDetails = asyncHandler(async (req, res) => {
  const { projectId, groupId, search } = req.query;

  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const projectObjectId = toObjectId(projectId, 'projectId');
  await ensureProjectExists(projectId);

  const filters = [
    { project: projectObjectId },
    activeLatestFilter(),
  ];

  if (groupId) {
    filters.push({ group: toObjectId(groupId, 'groupId') });
  }

  if (search) {
    filters.push(buildSearchMatch(search, ['key', 'name', 'caseKey', 'title', 'description']));
  }

  const match = filters.length === 1 ? filters[0] : { $and: filters };

  const testCases = await TestCase.find(match)
    .sort({ createdAt: -1 })
    .populate('group', 'name key deletedAt')
    .lean();

  if (testCases.length === 0) {
    res.json({ testCases: [] });
    return;
  }

  const entityIds = testCases
    .map((testCase) => testCase.entityId)
    .filter(Boolean);

  const allCaseVersions = await TestCase.find({
    project: projectObjectId,
    entityId: { $in: entityIds },
  })
    .select('_id entityId')
    .lean();

  const versionIdToEntityId = new Map(
    allCaseVersions.map((row) => [objectIdString(row._id), objectIdString(row.entityId)]),
  );
  const versionIds = allCaseVersions.map((row) => row._id);

  let recentByEntity = new Map();
  if (versionIds.length > 0) {
    const historyRows = await TestRun.aggregate([
      {
        $match: {
          project: projectObjectId,
        },
      },
      {
        $unwind: '$results',
      },
      {
        $match: {
          'results.status': { $in: ['pass', 'fail', 'blocked', 'skip'] },
          'results.testCase': { $in: versionIds },
        },
      },
      {
        $sort: {
          'results.executedAt': -1,
          updatedAt: -1,
          startedAt: -1,
        },
      },
      {
        $project: {
          testCase: '$results.testCase',
          status: '$results.status',
        },
      },
    ]);

    recentByEntity = historyRows.reduce((acc, row) => {
      const entityId = versionIdToEntityId.get(objectIdString(row.testCase));
      if (!entityId) {
        return acc;
      }

      const existing = acc.get(entityId) || [];
      if (existing.length < 3) {
        existing.push(row.status);
        acc.set(entityId, existing);
      }

      return acc;
    }, new Map());
  }

  const detailRows = testCases.map((testCase) => ({
    ...testCase,
    recentStatuses: recentByEntity.get(objectIdString(testCase.entityId)) || [],
  }));

  res.json({ testCases: detailRows });
});

const getTestCase = asyncHandler(async (req, res) => {
  const { testCaseId } = req.params;
  const testCase = await TestCase.findById(toObjectId(testCaseId, 'testCaseId'))
    .populate('project', 'name code deletedAt')
    .populate('group', 'name key deletedAt')
    .lean();
  if (!testCase) {
    throw httpError(404, 'Test case not found');
  }

  res.json({ testCase });
});

const getTestCaseVersions = asyncHandler(async (req, res) => {
  const { testCaseId } = req.params;
  const versions = await getVersionHistory(TestCase, testCaseId);
  res.json({ versions });
});

const updateTestCase = asyncHandler(async (req, res) => {
  const { testCaseId } = req.params;
  const {
    projectId,
    groupId,
    caseKey,
    key,
    title,
    name,
    description,
    steps,
    priority,
    severity,
    type,
    status,
  } = req.body;

  const updated = await updateVersionedDocument(TestCase, testCaseId, async (current) => {
    const nextProjectId = projectId ? toObjectId(projectId, 'projectId') : current.project;
    const nextGroupId = groupId ? toObjectId(groupId, 'groupId') : current.group;

    await ensureProjectExists(nextProjectId, { includeDeleted: false });
    await ensureGroupExists(nextGroupId, nextProjectId, { includeDeleted: false });

    const normalizedKey = normalizeKey(key || caseKey || current.key || current.caseKey);
    const normalizedName = normalizeName(name || title || current.name || current.title);

    const duplicate = await TestCase.findOne({
      _id: { $ne: current._id },
      project: nextProjectId,
      group: nextGroupId,
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case key or name already exists in this group');
    }

    const nextSteps = Array.isArray(steps)
      ? steps
          .filter((step) => step && step.action && step.expected)
          .map((step, index) => ({
            order: index + 1,
            action: String(step.action),
            expected: String(step.expected),
          }))
      : current.steps;

    return {
      project: nextProjectId,
      group: nextGroupId,
      key: normalizedKey,
      name: normalizedName,
      caseKey: normalizedKey,
      title: normalizedName,
      description: description !== undefined ? description || '' : current.description,
      steps: nextSteps,
      priority: priority || current.priority,
      severity: severity || current.severity,
      type: type || current.type,
      status: status && ['active', 'deprecated'].includes(status) ? status : current.status,
      createdBy: current.createdBy,
    };
  });

  const populated = await TestCase.findById(updated._id)
    .populate('project', 'name code deletedAt')
    .populate('group', 'name key deletedAt')
    .lean();

  res.json({ testCase: populated });
});

const importTestCases = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw httpError(400, 'File is required');
  }

  const { projectId } = req.body;
  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const project = await ensureProjectExists(projectId);

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
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
          project: project._id,
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

        const steps = [];
        for (const s of detectedSteps) {
          const action = String(row[s.key] || '').trim();
          if (action) {
            steps.push({ order: s.idx, action, expected: expectedResult });
          }
        }

        if (steps.length === 0) {
          errors.push({ row: i + 2, error: 'At least one step action is required' });
          continue;
        }

        const normalizedKey = normalizeKey(caseKey);
        const normalizedName = normalizeName(title);

        const duplicate = await TestCase.findOne({
          project: project._id,
          group: group._id,
          deletedAt: null,
          isLatest: true,
          $or: [{ key: normalizedKey }, { name: normalizedName }],
        }).lean();
        if (duplicate) {
          errors.push({
            row: i + 2,
            error: `Test case '${normalizedKey}' already exists in group '${group.name}'`,
          });
          continue;
        }

        // validation for priority/severity/type may be strict based on flag
        const strict = String(req.body.strict || '').toLowerCase() === 'true';

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
          project: project._id,
          group: group._id,
          key: normalizedKey,
          name: normalizedName,
          caseKey: normalizedKey,
          title: normalizedName,
          description,
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
          createdBy: req.user.id,
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

    res.json({
      message: `Imported ${created.length} test cases`,
      created,
      errors,
      total: rows.length,
    });
  } catch (err) {
    throw httpError(400, `Excel parsing error: ${err.message}`);
  }
});
const deleteTestCase = asyncHandler(async (req, res) => {
  await softDeleteVersionSeries(TestCase, req.params.testCaseId);
  res.status(204).send();
});

const restoreTestCase = asyncHandler(async (req, res) => {
  await restoreVersionSeries(TestCase, req.params.testCaseId);
  const testCase = await TestCase.findById(toObjectId(req.params.testCaseId, 'testCaseId'))
    .populate('project', 'name code deletedAt')
    .populate('group', 'name key deletedAt')
    .lean();
  res.json({ testCase });
});

// Test plan CRUD
const createTestPlan = asyncHandler(async (req, res) => {
  const { name, key, description, projectId, versionId, caseIds, executionMode, ownerId, assigneeIds } = req.body;

  if (!name || !projectId || !versionId || !Array.isArray(caseIds) || caseIds.length === 0) {
    throw httpError(400, 'name, projectId, versionId and caseIds[] are required');
  }

  const project = await ensureProjectExists(projectId);
  const releaseVersion = await ensureVersionExists(versionId, project._id);
  const normalizedKey = normalizeKey(key || name);
  const normalizedName = normalizeName(name);

  const duplicate = await TestPlan.findOne({
    project: project._id,
    version: releaseVersion._id,
    deletedAt: null,
    isLatest: true,
    $or: [{ key: normalizedKey }, { name: normalizedName }],
  }).lean();
  if (duplicate) {
    throw httpError(409, 'Test plan name or key already exists in this release version');
  }

  const validCaseIds = [];
  for (let index = 0; index < caseIds.length; index += 1) {
    const testCase = await ensureTestCaseExists(caseIds[index], project._id, { includeDeleted: true });
    if (String(testCase.project) !== String(project._id)) {
      throw httpError(400, 'Some caseIds do not exist in selected project');
    }

    validCaseIds.push({
      testCase: testCase._id,
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
    project: project._id,
    version: releaseVersion._id,
    createdBy: req.user.id,
    owner: ownerId ? toObjectId(ownerId, 'ownerId') : undefined,
    assignees: Array.isArray(assigneeIds)
      ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
      : [],
    executionMode: executionMode === 'automation' ? 'automation' : 'manual',
    items: validCaseIds,
  });

  res.status(201).json({ testPlan });
});

const listTestPlans = asyncHandler(async (req, res) => {
  const { projectId, versionId, search, includeDeleted } = req.query;
  const baseFilters = {};

  if (projectId) {
    baseFilters.project = toObjectId(projectId, 'projectId');
  } else {
    const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
    baseFilters.project = { $in: activeProjectIds };
  }

  if (versionId) {
    baseFilters.version = toObjectId(versionId, 'versionId');
  }

  const { docs: testPlans, pagination } = await buildVersionedList({
    model: TestPlan,
    query: req.query,
    search,
    searchFields: ['key', 'name', 'description'],
    baseFilters,
    populate: [
      { path: 'project', select: 'name code deletedAt' },
      { path: 'version', select: 'name deletedAt' },
      { path: 'owner', select: 'name email role' },
      { path: 'assignees', select: 'name email role' },
      { path: 'items.testCase', select: 'key name caseKey title deletedAt' },
    ],
    includeDeleted: includeDeleted === 'true',
  });

  const visiblePlans = req.user.role === 'admin'
    ? testPlans
    : testPlans.filter((plan) => isPlanAssignedToUser(plan, req.user.id));

  res.json({ testPlans: visiblePlans, pagination });
});

const getTestPlan = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const testPlan = await TestPlan.findById(toObjectId(testPlanId, 'testPlanId'))
    .populate('project', 'name code deletedAt')
    .populate('version', 'name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'key name caseKey title deletedAt')
    .lean();

  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  res.json({ testPlan });
});

const getTestPlanVersions = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const versions = await getVersionHistory(TestPlan, testPlanId);
  res.json({ versions });
});

const assignTestPlanItems = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const { assigneeIds } = req.body;

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
    owner: toObjectId(req.user.id, 'ownerId'),
    assignees: assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`)),
    items: current.items,
    createdBy: current.createdBy || req.user.id,
  }));

  const populated = await TestPlan.findById(nextTestPlan._id)
    .populate('project', 'name code deletedAt')
    .populate('version', 'name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'key name caseKey title deletedAt')
    .lean();

  res.json({ testPlan: populated });
});

const updateTestPlan = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const { name, key, description, projectId, versionId, caseIds, executionMode, ownerId, assigneeIds } = req.body;

  const nextTestPlan = await updateVersionedDocument(TestPlan, testPlanId, async (current) => {
    const nextProjectId = projectId ? toObjectId(projectId, 'projectId') : current.project;
    const nextVersionId = versionId ? toObjectId(versionId, 'versionId') : current.version;

    await ensureProjectExists(nextProjectId, { includeDeleted: false });
    await ensureVersionExists(nextVersionId, nextProjectId, { includeDeleted: false });

    const normalizedName = name ? normalizeName(name) : current.name;
    const normalizedKey = normalizeKey(key || current.key || current.name);

    const duplicate = await TestPlan.findOne({
      _id: { $ne: current._id },
      project: nextProjectId,
      version: nextVersionId,
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
      for (let index = 0; index < caseIds.length; index += 1) {
        const testCase = await ensureTestCaseExists(caseIds[index], nextProjectId, { includeDeleted: true });
        if (String(testCase.project) !== String(nextProjectId)) {
          throw httpError(400, 'Some caseIds do not exist in selected project');
        }

        items.push({
          testCase: testCase._id,
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
      version: nextVersionId,
      executionMode: executionMode && ['manual', 'automation'].includes(executionMode) ? executionMode : current.executionMode,
      owner: ownerId ? toObjectId(ownerId, 'ownerId') : current.owner,
      assignees: Array.isArray(assigneeIds)
        ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
        : current.assignees,
      items,
      createdBy: current.createdBy || req.user.id,
    };
  });

  const populated = await TestPlan.findById(nextTestPlan._id)
    .populate('project', 'name code deletedAt')
    .populate('version', 'name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'key name caseKey title deletedAt')
    .lean();

  res.json({ testPlan: populated });
});

const deleteTestPlan = asyncHandler(async (req, res) => {
  await softDeleteVersionSeries(TestPlan, req.params.testPlanId);
  res.status(204).send();
});

const restoreTestPlan = asyncHandler(async (req, res) => {
  await restoreVersionSeries(TestPlan, req.params.testPlanId);
  const testPlan = await TestPlan.findById(toObjectId(req.params.testPlanId, 'testPlanId'))
    .populate('project', 'name code deletedAt')
    .populate('version', 'name deletedAt')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'key name caseKey title deletedAt')
    .lean();
  res.json({ testPlan });
});

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  restoreProject,
  createVersion,
  listVersions,
  getVersion,
  updateVersion,
  deleteVersion,
  restoreVersion,
  createTestCaseGroup,
  listTestCaseGroups,
  getTestCaseGroup,
  getTestCaseGroupVersions,
  updateTestCaseGroup,
  deleteTestCaseGroup,
  restoreTestCaseGroup,
  createTestCase,
  listTestCases,
  listTestCaseDetails,
  importTestCases,
  getTestCase,
  getTestCaseVersions,
  updateTestCase,
  deleteTestCase,
  restoreTestCase,
  createTestPlan,
  listTestPlans,
  getTestPlan,
  getTestPlanVersions,
  assignTestPlanItems,
  updateTestPlan,
  deleteTestPlan,
  restoreTestPlan,
};
