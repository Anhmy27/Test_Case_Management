const mongoose = require('mongoose');
const Project = require('../../models/Project');
const Version = require('../../models/Version');
const TestCase = require('../../models/TestCase');
const TestCaseGroup = require('../../models/TestCaseGroup');
const { httpError } = require('../../utils/httpError');
const { activeLatestFilter, extractReferenceId, toObjectId } = require('./versioningCore');

const ensureProjectExists = async (projectId, { includeDeleted = false } = {}) => {
  const entityQuery = { entityId: toObjectId(projectId, 'projectId') };
  if (!includeDeleted) {
    entityQuery.$or = [{ isLatest: true }, { isLatest: { $exists: false } }];
    entityQuery.deletedAt = null;
  }

  let project = await Project.findOne(entityQuery).lean();
  if (project) return project;

  const idQuery = { _id: toObjectId(projectId, 'projectId') };
  if (!includeDeleted) {
    idQuery.deletedAt = null;
  }
  project = await Project.findOne(idQuery).lean();
  if (!project) throw httpError(404, 'Project not found');

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

  const items = Array.isArray(testPlan.items) ? testPlan.items : [];
  const versionIds = Array.from(
    new Set(items.map((item) => String(item.testCaseVersionId || '').trim()).filter(Boolean)),
  );
  const referencedCaseIds = Array.from(
    new Set(items.map((item) => extractReferenceId(item.testCase)).filter(Boolean)),
  );
  const objectIdRefs = referencedCaseIds
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => toObjectId(value, 'testCaseId'));

  const caseSelect = 'entityId key name caseKey title deletedAt automation.enabled automation.baseUrl';

  const [versionCases, latestCases] = await Promise.all([
    versionIds.length
      ? TestCase.find({
        _id: { $in: versionIds.map((value) => toObjectId(value, 'testCaseId')) },
        deletedAt: null,
      }).select(caseSelect).lean()
      : [],
    objectIdRefs.length
      ? TestCase.find({
        $and: [
          {
            $or: [
              { _id: { $in: objectIdRefs } },
              { entityId: { $in: objectIdRefs } },
            ],
          },
          { deletedAt: null },
          { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
        ],
      }).select(caseSelect).lean()
      : [],
  ]);

  const versionMap = new Map(versionCases.map((testCase) => [String(testCase._id), testCase]));
  const refMap = new Map();
  for (const testCase of latestCases) {
    refMap.set(String(testCase._id), testCase);
    if (testCase.entityId) {
      refMap.set(String(testCase.entityId), testCase);
    }
  }

  return {
    ...testPlan,
    items: items.map((item) => {
      const pinnedId = String(item.testCaseVersionId || '').trim();
      const pinnedCase = pinnedId ? versionMap.get(pinnedId) : null;
      const refId = extractReferenceId(item.testCase);
      const resolvedCase = pinnedCase || (refId ? refMap.get(refId) : null) || item.testCase || null;

      return {
        ...item,
        testCase: resolvedCase,
      };
    }),
  };
};

module.exports = {
  ensureProjectExists,
  resolveLatestProjectSnapshot,
  ensureVersionExists,
  ensureGroupExists,
  buildTestCaseConflict,
  resolveTestCaseByReference,
  attachTestPlanCases,
};
