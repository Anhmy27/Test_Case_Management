const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const User = require('../models/User');
const { executeAutomationRun } = require('../services/playwrightAutomationService');
const { asyncHandler } = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
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

const findTestPlanByReference = async (testPlanRef) => {
  if (!testPlanRef) {
    return null;
  }

  const objectId = toObjectId(testPlanRef, 'testPlanId');
  return TestPlan.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

/** All plan document _ids for the same logical test plan (version lineage). */
const getTestPlanVersionIds = async (testPlan) => {
  if (!testPlan) {
    return [];
  }

  const planEntityId = testPlan.entityId || testPlan._id;
  const versionIds = await TestPlan.distinct('_id', {
    entityId: planEntityId,
    deletedAt: null,
  });

  if (versionIds.length > 0) {
    return versionIds;
  }

  return testPlan._id ? [testPlan._id] : [];
};

const findLatestTestCaseByReference = async (testCaseRef) => {
  if (!testCaseRef) {
    return null;
  }

  const objectId = toObjectId(testCaseRef, 'testCaseId');
  const referencedCase = await TestCase.findOne({
    $or: [{ _id: objectId }, { entityId: objectId }],
  }).lean();

  if (!referencedCase) {
    return null;
  }

  const entityId = referencedCase.entityId || referencedCase._id;
  const latestCase = await TestCase.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();

  return latestCase || referencedCase;
};

const buildTestRunReferenceMatch = (runRef) => {
  const objectId = toObjectId(runRef, 'runId');
  return {
    $or: [{ entityId: objectId }, { _id: objectId }],
  };
};

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

const findProjectByReference = async (projectRef) => {
  if (!projectRef) {
    return null;
  }

  const objectId = toObjectId(projectRef, 'projectId');

  const referencedProject = await Project.findOne({
    $or: [{ entityId: objectId }, { _id: objectId }],
  }).lean();

  if (!referencedProject) {
    return null;
  }

  const entityId = referencedProject.entityId || referencedProject._id;
  const latestProject = await Project.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();

  return latestProject || (referencedProject.deletedAt ? null : referencedProject);
};

const findVersionByReference = async (versionRef) => {
  if (!versionRef) {
    return null;
  }

  const objectId = toObjectId(versionRef, 'versionId');

  // First pass: find any document matching this ref, regardless of deletedAt/isLatest,
  // so we can get the entityId needed to find the current live version.
  const referencedVersion = await Version.findOne({
    $or: [{ entityId: objectId }, { _id: objectId }],
  }).lean();

  if (!referencedVersion) {
    return null;
  }

  const entityId = referencedVersion.entityId || referencedVersion._id;

  // Second pass: find the live latest version using entityId.
  const latestVersion = await Version.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();

  // Fall back to the referenced version if no live latest exists (e.g. old data without entityId).
  return latestVersion || (referencedVersion.deletedAt ? null : referencedVersion);
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
          idjira: version.idjira,
        }
      : testRun?.version || null,
  };
};

const createProject = asyncHandler(async (req, res) => {
  const { name, code, description, jiraProjectKey, jiraProductKey, Jiraproduckeys, JiraProductKey } = req.body;
  if (!name || !code) {
    throw httpError(400, 'name and code are required');
  }

  // Check if project code already exists
  const existingProject = await Project.findOne({ code: code.toUpperCase() }).lean();
  if (existingProject) {
    throw httpError(409, `Project code "${code}" already exists`);
  }

  const normalizedJiraProjectKey = String(jiraProjectKey || '').trim();
  const normalizedJiraProductKey = String(jiraProductKey || Jiraproduckeys || JiraProductKey || jiraProjectKey || '').trim();

  const project = await Project.create({
    name,
    code,
    description: description || '',
    jiraProjectKey: normalizedJiraProjectKey,
    jiraProductKey: normalizedJiraProductKey,
    createdBy: req.user.id,
  });

  res.status(201).json({ project });
});

const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, code, description, status, jiraProjectKey, jiraProductKey, Jiraproduckeys, JiraProductKey } = req.body;

  const project = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  });
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  // If updating code, check for duplicates
  if (code && code.toUpperCase() !== project.code) {
    const existingProject = await Project.findOne({ code: code.toUpperCase() }).lean();
    if (existingProject) {
      throw httpError(409, `Project code "${code}" already exists`);
    }
  }

  if (name) project.name = name;
  if (code) project.code = code;
  if (description !== undefined) project.description = description || '';
  if (jiraProjectKey !== undefined) {
    project.jiraProjectKey = String(jiraProjectKey || '').trim();
  }
  if (jiraProductKey !== undefined || Jiraproduckeys !== undefined || JiraProductKey !== undefined || jiraProjectKey !== undefined) {
    project.jiraProductKey = String(jiraProductKey || Jiraproduckeys || JiraProductKey || jiraProjectKey || '').trim();
  }
  if (status && ['active', 'archived'].includes(status)) project.status = status;

  await project.save();

  res.json({ project });
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const objectId = toObjectId(projectId, 'projectId');

  const [versionCount, groupCount, caseCount, planCount, runCount] = await Promise.all([
    Version.countDocuments({ project: objectId }),
    TestCaseGroup.countDocuments({ project: objectId }),
    TestCase.countDocuments({ project: objectId }),
    TestPlan.countDocuments({ project: objectId }),
    TestRun.countDocuments({ project: objectId }),
  ]);

  if (versionCount || groupCount || caseCount || planCount || runCount) {
    throw httpError(409, 'Project has related records and cannot be deleted');
  }

  const deleted = await Project.findByIdAndDelete(objectId);
  if (!deleted) {
    throw httpError(404, 'Project not found');
  }

  res.status(204).send();
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

const createVersion = asyncHandler(async (req, res) => {
  const { projectId, name, idjira, releaseDate, notes } = req.body;
  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  // Normalize idjira
  const idjiraValue = String(idjira || '').trim();

  // Check for duplicate version name or idjira in same project
  const dupQuery = {
    project: project._id,
    $or: [{ name }, { ...(idjiraValue ? { idjira: idjiraValue } : {}) }],
  };
  const existingVersion = await Version.findOne(dupQuery).lean();
  if (existingVersion) {
    throw httpError(409, `Version with the same name or Jira id already exists in this project`);
  }

  const version = await Version.create({
    project: project._id,
    name,
    idjira: idjiraValue,
    releaseDate,
    notes: notes || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ version });
});

const listVersions = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};
  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) {
      res.json({ versions: [] });
      return;
    }
    query.project = projectDoc._id;
  }

  const versions = await Version.find(query).sort({ createdAt: -1 }).lean();
  res.json({ versions });
});

const createTestCaseGroup = asyncHandler(async (req, res) => {
  const { projectId, name, description } = req.body;

  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const projectRef = project.entityId || project._id;

  // Check for duplicate group name in same project
  const existingGroup = await TestCaseGroup.findOne({ 
    project: { $in: [project._id, project.entityId].filter(Boolean) }, 
    name: name 
  }).lean();
  if (existingGroup) {
    throw httpError(409, `Test case group "${name}" already exists in this project`);
  }

  const group = await TestCaseGroup.create({
    project: projectRef,
    name,
    description: description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ group });
});

const listTestCaseGroups = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};

  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) {
      res.json({ groups: [] });
      return;
    }
    query.project = projectDoc._id;
  }

  const groups = await TestCaseGroup.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .lean();

  res.json({ groups });
});

const createTestCase = asyncHandler(async (req, res) => {
  const {
    projectId,
    groupId,
    caseKey,
    title,
    description,
    steps,
    priority,
    severity,
    type,
  } = req.body;

  if (!projectId || !groupId || !caseKey || !title) {
    throw httpError(400, 'projectId, groupId, caseKey and title are required');
  }

  const project = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const projectRef = project.entityId || project._id;

  const group = await TestCaseGroup.findOne({
    $and: [
      { $or: [{ entityId: toObjectId(groupId, 'groupId') }, { _id: toObjectId(groupId, 'groupId') }] },
      { project: { $in: [project._id, project.entityId].filter(Boolean) } },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      { deletedAt: null },
    ],
  }).lean();
  if (!group) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  // Check for duplicate caseKey in same group
  const existingCase = await TestCase.findOne({ 
    project: { $in: [project._id, project.entityId].filter(Boolean) }, 
    group: { $in: [group._id, group.entityId].filter(Boolean) }, 
    caseKey: caseKey.toUpperCase() 
  }).lean();
  if (existingCase) {
    throw httpError(409, `Test case key "${caseKey}" already exists in this group`);
  }

  const normalizedSteps = Array.isArray(steps)
    ? steps
        .filter((step) => step && step.action)
        .map((step, index) => ({
          order: index + 1,
          action: String(step.action),
          expected: String(req.body.expected || step.expected || '').trim(),
        }))
    : [];

  const testCase = await TestCase.create({
    project: projectRef,
    group: group.entityId || group._id,
    caseKey,
    title,
    description: description || '',
    expected: String(req.body.expected || '').trim(),
    steps: normalizedSteps,
    priority,
    severity,
    type,
    createdBy: req.user.id,
  });

  res.status(201).json({ testCase });
});

const updateTestCase = asyncHandler(async (req, res) => {
  const { testCaseId } = req.params;
  const {
    projectId,
    groupId,
    caseKey,
    title,
    description,
    steps,
    priority,
    severity,
    type,
    status,
  } = req.body;

  const testCase = await TestCase.findOne({
    entityId: toObjectId(testCaseId, 'testCaseId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  });
  if (!testCase) {
    throw httpError(404, 'Test case not found');
  }

  let nextProjectId;
  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) throw httpError(404, 'Project not found');
    nextProjectId = projectDoc.entityId || projectDoc._id;
  } else {
    nextProjectId = testCase.project;
  }

  let nextGroupId;
  if (groupId) {
    const groupDoc = await TestCaseGroup.findOne({
      entityId: toObjectId(groupId, 'groupId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!groupDoc) throw httpError(404, 'Test case group not found');
    nextGroupId = groupDoc.entityId || groupDoc._id;
  } else {
    nextGroupId = testCase.group;
  }

  const nextCaseKey = caseKey || testCase.caseKey;

  const group = await TestCaseGroup.findOne({
    $and: [
      { $or: [{ entityId: nextGroupId }, { _id: nextGroupId }] },
      { project: { $in: [nextProjectId].filter(Boolean) } },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      { deletedAt: null },
    ],
  }).lean();
  if (!group) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  // Check for duplicate if caseKey or group is being changed
  if (caseKey || groupId) {
    const existingCase = await TestCase.findOne({ 
      project: { $in: [nextProjectId].filter(Boolean) },
      group: { $in: [nextGroupId].filter(Boolean) },
      caseKey: nextCaseKey.toUpperCase(),
      _id: { $ne: testCase._id } // Exclude current case
    }).lean();
    if (existingCase) {
      throw httpError(409, `Test case key "${nextCaseKey}" already exists in this group`);
    }
  }

  if (projectId) testCase.project = nextProjectId;
  if (groupId) testCase.group = nextGroupId;
  if (caseKey) testCase.caseKey = caseKey;
  if (title) testCase.title = title;
  if (description !== undefined) testCase.description = description || '';
  if (priority) testCase.priority = priority;
  if (severity) testCase.severity = severity;
  if (type) testCase.type = type;
  if (status && ['active', 'deprecated'].includes(status)) testCase.status = status;
  if (req.body.expected !== undefined) testCase.expected = String(req.body.expected || '').trim();

  if (Array.isArray(steps)) {
    testCase.steps = steps
      .filter((step) => step && step.action)
      .map((step, index) => ({
        order: index + 1,
        action: String(step.action),
        expected: String(req.body.expected || step.expected || '').trim(),
      }));
  }

  await testCase.save();

  const updated = await TestCase.findById(testCase._id)
    .populate('project', 'entityId name code')
    .populate('group', 'entityId name description')
    .lean();

  res.json({ testCase: updated });
});

const deleteTestCase = asyncHandler(async (req, res) => {
  const { testCaseId } = req.params;
  // Resolve entityId -> document _id if necessary
  const foundCase = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId') }).lean();
  const objectId = foundCase ? foundCase._id : toObjectId(testCaseId, 'testCaseId');

  const [planCount, runCount] = await Promise.all([
    TestPlan.countDocuments({ 'items.testCase': objectId }),
    TestRun.countDocuments({ 'results.testCase': objectId }),
  ]);

  if (planCount || runCount) {
    throw httpError(409, 'Test case is referenced by plans or runs and cannot be deleted');
  }

  const deleted = await TestCase.findByIdAndDelete(objectId);
  if (!deleted) {
    throw httpError(404, 'Test case not found');
  }

  res.status(204).send();
});

const listTestCases = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};
  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) {
      res.json({ testCases: [] });
      return;
    }
    query.project = projectDoc._id;
  }

  const testCases = await TestCase.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .populate('group', 'name description')
    .lean();

  res.json({ testCases });
});

const createTestPlan = asyncHandler(async (req, res) => {
  const { name, description, projectId, versionId, caseIds, executionMode } = req.body;

  if (!name || !projectId || !versionId || !Array.isArray(caseIds) || caseIds.length === 0) {
    throw httpError(400, 'name, projectId, versionId and caseIds[] are required');
  }

  const project = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const versionObjectId = toObjectId(versionId, 'versionId');
  const referencedVersion = await Version.findOne({
    $or: [{ entityId: versionObjectId }, { _id: versionObjectId }],
    deletedAt: null,
  }).lean();

  if (!referencedVersion) {
    throw httpError(404, 'Version not found in selected project');
  }

  const versionEntityId = referencedVersion.entityId || referencedVersion._id;
  const version = await Version.findOne({
    entityId: versionEntityId,
    project: project._id,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();

  if (!version || String(version.project) !== String(project._id)) {
    throw httpError(404, 'Version not found in selected project');
  }

  // Check for duplicate plan name in same version
  const existingPlan = await TestPlan.findOne({ 
    project: project._id, 
    version: version._id, 
    name: name 
  }).lean();
  if (existingPlan) {
    throw httpError(409, `Test plan "${name}" already exists in this version`);
  }

  const validCaseIds = caseIds.map((id, index) => ({
    testCase: toObjectId(id, `caseIds[${index}]`),
    order: index + 1,
    assignees: [],
  }));

  const totalCases = await TestCase.countDocuments({
    _id: { $in: validCaseIds.map((item) => item.testCase) },
    project: project._id,
  });

  if (totalCases !== validCaseIds.length) {
    throw httpError(400, 'Some caseIds do not exist in selected project');
  }

  const testPlan = await TestPlan.create({
    name,
    description: description || '',
    project: project.entityId ? project.entityId : project._id,
    version: version.entityId ? version.entityId : version._id,
    createdBy: req.user.id,
    executionMode: executionMode === 'automation' ? 'automation' : 'manual',
    items: validCaseIds,
  });

  res.status(201).json({ testPlan });
});

const listTestPlans = asyncHandler(async (req, res) => {
  const { projectId, versionId } = req.query;
  const query = {};

  if (projectId) {
    const projectDoc = await findProjectByReference(projectId);
    if (!projectDoc) {
      res.json({ testPlans: [] });
      return;
    }
    const projectRefs = [projectDoc._id, projectDoc.entityId].filter(Boolean);
    query.project = projectRefs.length > 1 ? { $in: projectRefs } : projectRefs[0];
  }

  if (versionId) {
    const versionDoc = await findVersionByReference(versionId);
    if (!versionDoc) {
      res.json({ testPlans: [] });
      return;
    }
    const versionRefs = [
      versionDoc._id,
      versionDoc.entityId,
    ].filter(Boolean);
    query.version = versionRefs.length > 1 ? { $in: versionRefs } : versionRefs[0];
  }

  const testPlans = await TestPlan.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code entityId')
    .populate('version', 'name entityId')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'caseKey title')
    .lean();

  const visiblePlans = req.user.role === 'admin'
    ? testPlans
    : testPlans.filter((plan) => isPlanAssignedToUser(plan, req.user.id));

  res.json({ testPlans: visiblePlans });
});

const assignTestPlanItems = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const { assigneeIds } = req.body;

  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    throw httpError(400, 'assigneeIds[] is required');
  }

  const testPlan = await TestPlan.findOne({
    entityId: toObjectId(testPlanId, 'testPlanId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  });
  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  testPlan.owner = toObjectId(req.user.id, 'ownerId');

  testPlan.assignees = assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`));

  await testPlan.save();

  const populated = await TestPlan.findOne({ _id: testPlan._id })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'caseKey title')
    .lean();

  res.json({ testPlan: populated });
});

const updateTestPlan = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const { executionMode } = req.body;

  if (!executionMode || !['manual', 'automation'].includes(executionMode)) {
    throw httpError(400, 'executionMode must be "manual" or "automation"');
  }

  const testPlan = await TestPlan.findOne({
    entityId: toObjectId(testPlanId, 'testPlanId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  });
  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  testPlan.executionMode = executionMode;
  await testPlan.save();

  const populated = await TestPlan.findOne({ _id: testPlan._id })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'caseKey title')
    .lean();

  res.json({ testPlan: populated });
});

const startTestRun = asyncHandler(async (req, res) => {
  const { testPlanId, name, baseUrl } = req.body;
  if (!testPlanId || !name) {
    throw httpError(400, 'testPlanId and name are required');
  }

  const resolvedTestPlan = await TestPlan.findOne({
    $and: [
      {
        $or: [
          { entityId: toObjectId(testPlanId, 'testPlanId') },
          { _id: toObjectId(testPlanId, 'testPlanId') },
        ],
      },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();
  if (!resolvedTestPlan) {
    throw httpError(404, 'Test plan not found');
  }

  const testPlan = resolvedTestPlan;

  if (req.user.role !== 'admin' && !isPlanAssignedToUser(testPlan, req.user.id)) {
    throw httpError(403, 'You are not assigned to this test plan');
  }

  const resolvedProject = await findProjectByReference(testPlan.project);
  const resolvedVersion = await findVersionByReference(testPlan.version);

  if (!resolvedProject) {
    throw httpError(404, 'Project not found');
  }

  if (!resolvedVersion) {
    throw httpError(404, 'Version not found');
  }

  // Check duplicate run name only within this logical test plan (same entityId lineage).
  // Do not match testPlan.entityId directly — it can equal another plan document's _id.
  const testPlanRef = testPlan._id;
  const relatedPlanIds = await getTestPlanVersionIds(testPlan);

  const existingRun = await TestRun.findOne({
    testPlan: { $in: relatedPlanIds },
    name: name.trim(),
  }).lean();
  if (existingRun) {
    throw httpError(409, `A test run with name "${name}" already exists for this test plan`);
  }

  const latestTestCases = await Promise.all(
    testPlan.items.map((item) => findLatestTestCaseByReference(item.testCase))
  );

  const missingLatestCaseIndex = latestTestCases.findIndex((testCase) => !testCase);
  if (missingLatestCaseIndex !== -1) {
    throw httpError(404, 'A test case in this test plan could not be resolved to the latest version');
  }

  // Resolve group snapshots (store the active/latest group document _id at run start)
  const latestGroups = await Promise.all(latestTestCases.map(async (tc) => {
    if (!tc || !tc.group) return null;
    const foundGroup = await TestCaseGroup.findOne({
      $and: [
        { $or: [ { _id: tc.group }, { entityId: tc.group } ] },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    }).lean();
    return foundGroup || null;
  }));

  const results = testPlan.items.map((item, index) => ({
    planItemId: item._id,
    testCase: latestTestCases[index]._id,
    group: latestGroups[index] ? latestGroups[index]._id : (latestTestCases[index] ? latestTestCases[index].group : null),
    owner: testPlan.owner,
    assignees: testPlan.assignees || [],
    tester: testPlan.owner || (testPlan.assignees && testPlan.assignees.length > 0 ? testPlan.assignees[0] : undefined),
    status: 'untested',
    note: '',
  }));

  const ownerSnapshot = testPlan.owner
    ? {
        _id: testPlan.owner._id,
        name: testPlan.owner.name,
        email: testPlan.owner.email,
        role: testPlan.owner.role,
      }
    : null;

  const assigneeSnapshot = Array.isArray(testPlan.assignees)
    ? testPlan.assignees.map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }))
    : [];

  const testRun = await TestRun.create({
    name,
    project: resolvedProject._id,
    version: resolvedVersion._id,
    testPlan: testPlanRef,
    status: 'running',
    startedAt: new Date(),
    startedBy: req.user.id,
    ownerSnapshot,
    assigneeSnapshot,
    results,
  });

  // Populate testPlan with executionMode for the response
  const populatedTestRun = await TestRun.findById(testRun._id)
    .lean();

  const testRunPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedTestRun));

  if (testPlan.executionMode === 'automation') {
    const automationResult = await executeAutomationRun({
      testRunId: testRun._id,
      baseUrl: baseUrl || '',
      executedBy: req.user.id,
    });

    const populatedAutomationRun = await TestRun.findById(automationResult.testRun._id)
      .lean();
    const automationRunPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedAutomationRun));

    return res.status(201).json({
      testRun: automationRunPayload,
      automationSummary: automationResult.summary,
      automationReport: automationResult.report,
    });
  }

  res.status(201).json({ testRun: testRunPayload });
});

const applyAutomationResults = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const { results } = req.body; // [{ planItemId, status, note }]

  if (!Array.isArray(results) || results.length === 0) {
    throw httpError(400, 'results[] is required');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const testPlan = await findTestPlanByReference(testRun.testPlan);
  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  if (testPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  // Permission: allow if caller is admin or provides automation secret
  const secret = req.headers['x-automation-secret'];
  const allowedBySecret = process.env.AUTOMATION_SECRET && secret === process.env.AUTOMATION_SECRET;
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin && !allowedBySecret) {
    throw httpError(403, 'Not authorized to submit automation results');
  }

  // update results by planItemId
  for (const item of results) {
    const { planItemId, status, note, notes } = item;
    if (!planItemId || !['pass', 'fail', 'blocked', 'skip'].includes(status)) {
      continue;
    }

    const match = testRun.results.find((r) => String(r.planItemId) === String(planItemId));
    if (!match) continue;

    match.status = status;
    match.note = note || '';
    match.notes = notes || '';
    match.executedAt = new Date();
    match.tester = isAdmin ? req.user.id : null;
  }

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = isAdmin ? req.user.id : null;

  await testRun.save();

  res.json({ testRun });
});

const listTestRuns = asyncHandler(async (req, res) => {
  const { projectId, versionId, status } = req.query;
  const query = {};

  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) {
      res.json({ testRuns: [] });
      return;
    }
    const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    query.project = { $in: projectIds.map((value) => toObjectId(value, 'projectId')) };
  }

  if (versionId) {
    const versionDoc = await Version.findOne({
      entityId: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!versionDoc) {
      res.json({ testRuns: [] });
      return;
    }
    const versionRefs = await Version.find({ entityId: versionDoc.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((version) => [String(version._id), String(version.entityId || '')]).filter(Boolean),
    ));
    query.version = { $in: versionIds.map((value) => toObjectId(value, 'versionId')) };
  }

  if (status) {
    query.status = status;
  }

  if (req.user.role !== 'admin') {
    query.startedBy = toObjectId(req.user.id, 'userId');
  }

  const testRuns = await TestRun.find(query)
    .sort({ createdAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('endedBy', 'name email role')
    .lean();

  const testRunsWithProgress = [];
  for (const testRun of testRuns) {
    const withPlan = await attachRunTestPlan(testRun);
    const withProjectVersion = await attachRunProjectAndVersion(withPlan);
    const results = Array.isArray(testRun.results) ? testRun.results : [];
    const total = results.length;
    const executed = results.filter((result) => !['untested', 'skip'].includes(result.status)).length;
    const passCount = results.filter((result) => result.status === 'pass').length;

    testRunsWithProgress.push({
      ...withProjectVersion,
      progress: total > 0 ? Number(((executed / total) * 100).toFixed(2)) : 0,
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
      totalResults: total,
      executedResults: executed,
    });
  }

  res.json({ testRuns: testRunsWithProgress });
});

const getMyRunItems = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('results.testCase', 'caseKey title description steps priority severity')
    .populate('results.owner', 'name email role')
    .populate('results.assignees', 'name email role')
    .populate('results.tester', 'name email role')
    .lean();

  if (!testRun) {
    res.json({ testRun: null, results: [] });
    return;
  }

  const isAdmin = req.user.role === 'admin';

  const results = isAdmin
    ? testRun.results
    : testRun.results.filter((result) => {
        const ownerMatch = result.owner && String(result.owner._id) === req.user.id;
        const assigneeMatch = Array.isArray(result.assignees)
          && result.assignees.some((user) => String(user._id) === req.user.id);

        return ownerMatch || assigneeMatch;
      });

  const [project, version, plan] = await Promise.all([
    findProjectByReference(testRun.project),
    findVersionByReference(testRun.version),
    findTestPlanByReference(testRun.testPlan),
  ]);

  res.json({
    testRun: {
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
        : testRun.project || null,
      version: version
        ? {
            _id: version._id,
            entityId: version.entityId,
            name: version.name,
            idjira: version.idjira,
          }
        : testRun.version || null,
      testPlan: plan
        ? {
            _id: plan._id,
            entityId: plan.entityId,
            name: plan.name,
            executionMode: plan.executionMode,
          }
        : testRun.testPlan || null,
    },
    results,
  });
});

const updateRunResult = asyncHandler(async (req, res) => {
  const { runId, resultId } = req.params;
  const { status, note, notes } = req.body;

  if (!['pass', 'fail', 'blocked', 'skip'].includes(status)) {
    throw httpError(400, 'status must be one of pass/fail/blocked/skip');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  if (testRun.status !== 'running') {
    throw httpError(400, 'Only running test run can be updated');
  }

  const result = testRun.results.id(resultId);
  if (!result) {
    throw httpError(404, 'Run result not found');
  }

  const isStarter = String(testRun.startedBy) === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isStarter && !isAdmin) {
    throw httpError(403, 'You do not have permission to update this test run');
  }

  result.status = status;
  result.note = note || '';
  result.notes = notes || '';
  result.executedAt = new Date();
  result.tester = req.user.id;

  await testRun.save();

  res.json({ testRun });
});

const endTestRun = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const isStarter = String(testRun.startedBy) === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isStarter && !isAdmin) {
    throw httpError(403, 'You do not have permission to end this test run');
  }

  if (testRun.status === 'completed') {
    throw httpError(409, 'Test run already completed');
  }

  // block manual ending for automation runs
  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (parentPlan && parentPlan.executionMode === 'automation') {
    throw httpError(403, 'Automation runs cannot be ended manually');
  }

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = req.user.id;
  await testRun.save();

  res.json({ testRun });
});

const getDashboard = asyncHandler(async (req, res) => {
  const { projectId, versionId } = req.query;
  const match = {};
  let resolvedProjectEntityId = null;
  let resolvedVersionEntityId = null;

  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) {
      // Return empty dashboard when project not found
      return res.json({
        summary: { totalRuns: 0, runningRuns: 0, totalCases: 0, pass: 0, fail: 0, blocked: 0, untested: 0, executed: 0, passRate: 0, completionRate: 0 },
        runs: [],
        runningTestRuns: [],
        delayedTestPlans: [],
        mostFailedTestCases: [],
        testerActivity: [],
        projectOverview: [],
      });
    }
    resolvedProjectEntityId = projectDoc.entityId;
    const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    match.project = { $in: projectIds.map((value) => toObjectId(value, 'projectId')) };
  }

  if (versionId) {
    const versionDoc = await Version.findOne({
      entityId: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!versionDoc) {
      // Return empty dashboard when version not found
      return res.json({
        summary: { totalRuns: 0, runningRuns: 0, totalCases: 0, pass: 0, fail: 0, blocked: 0, untested: 0, executed: 0, passRate: 0, completionRate: 0 },
        runs: [],
        runningTestRuns: [],
        delayedTestPlans: [],
        mostFailedTestCases: [],
        testerActivity: [],
        projectOverview: [],
      });
    }
    resolvedVersionEntityId = versionDoc.entityId;
    const versionRefs = await Version.find({ entityId: versionDoc.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((version) => [String(version._id), String(version.entityId || '')]).filter(Boolean),
    ));
    match.version = { $in: versionIds.map((value) => toObjectId(value, 'versionId')) };
  }

  const runs = await TestRun.aggregate([
    { $match: match },
    {
      $project: {
        status: 1,
        total: { $size: '$results' },
        passCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'pass'] },
            },
          },
        },
        failCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'fail'] },
            },
          },
        },
        blockedCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'blocked'] },
            },
          },
        },
        untestedCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $in: ['$$r.status', ['untested', 'skip']] },
            },
          },
        },
      },
    },
  ]);

  const summary = runs.reduce(
    (acc, run) => {
      acc.totalRuns += 1;
      acc.totalCases += run.total;
      acc.pass += run.passCount;
      acc.fail += run.failCount;
      acc.blocked += run.blockedCount;
      acc.untested += run.untestedCount;
      if (run.status === 'running') {
        acc.runningRuns += 1;
      }
      return acc;
    },
    {
      totalRuns: 0,
      runningRuns: 0,
      totalCases: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      untested: 0,
    }
  );

  summary.executed = summary.pass + summary.fail + summary.blocked;
  summary.passRate = summary.executed > 0 ? Number(((summary.pass / summary.executed) * 100).toFixed(2)) : 0;
  summary.completionRate = summary.totalCases > 0
    ? Number(((summary.executed / summary.totalCases) * 100).toFixed(2))
    : 0;

  const runningTestRuns = await TestRun.find({ ...match, status: 'running' })
    .sort({ startedAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('testPlan', 'name')
    .lean();

  const delayedTestPlans = await TestPlan.find(resolvedProjectEntityId
    ? { project: { $in: (await Project.find({ entityId: resolvedProjectEntityId }).select('_id entityId').lean()).flatMap((project) => [project._id, project.entityId].filter(Boolean)) }, deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] }
    : { deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] })
    .populate('project', 'name code')
    .populate('version', 'name')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  const plansWithRuns = await TestRun.find({ ...match })
    .select('testPlan')
    .lean();
  const startedPlanIds = new Set(plansWithRuns.map((run) => String(run.testPlan)));

  const delayedPlans = delayedTestPlans
    .filter((plan) => (Array.isArray(plan.assignees) && plan.assignees.length > 0) || plan.owner)
    .filter((plan) => !startedPlanIds.has(String(plan._id)))
    .slice(0, 8)
    .map((plan) => ({
      _id: String(plan._id),
      name: plan.name,
      project: plan.project,
      version: plan.version,
      owner: plan.owner,
      assignees: plan.assignees,
      createdAt: plan.createdAt,
    }));

  const failedCases = await TestRun.aggregate([
    { $match: match },
    { $unwind: '$results' },
    { $match: { 'results.status': 'fail' } },
    {
      $group: {
        _id: '$results.testCase',
        failCount: { $sum: 1 },
        lastRunAt: { $max: '$startedAt' },
        lastTesterId: { $last: '$results.tester' },
      },
    },
    { $sort: { failCount: -1, lastRunAt: -1 } },
    { $limit: 8 },
  ]);

  const failedCaseIds = failedCases.map((item) => item._id);
  const failedCaseDocs = await TestCase.find({ _id: { $in: failedCaseIds } })
    .select('caseKey title priority')
    .lean();

  const failedCaseMap = new Map(failedCaseDocs.map((item) => [String(item._id), item]));
  const mostFailedTestCases = failedCases.map((item) => {
    const testCase = failedCaseMap.get(String(item._id));
    return {
      testCaseId: String(item._id),
      caseKey: testCase?.caseKey || '',
      title: testCase?.title || 'Unknown test case',
      priority: testCase?.priority || 'medium',
      failCount: item.failCount,
    };
  });

  const testerActivityAgg = await TestRun.aggregate([
    { $match: match },
    { $unwind: '$results' },
    {
      $group: {
        _id: '$results.tester',
        totalTests: { $sum: { $cond: [{ $ifNull: ['$results.tester', false] }, 1, 0] } },
        passCount: {
          $sum: { $cond: [{ $eq: ['$results.status', 'pass'] }, 1, 0] },
        },
        failCount: {
          $sum: { $cond: [{ $eq: ['$results.status', 'fail'] }, 1, 0] },
        },
        blockedCount: {
          $sum: { $cond: [{ $eq: ['$results.status', 'blocked'] }, 1, 0] },
        },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $sort: { totalTests: -1 } },
    { $limit: 8 },
  ]);

  const testerIds = testerActivityAgg.map((item) => item._id);
  const testerDocs = await User.find({ _id: { $in: testerIds } })
    .select('name email role')
    .lean();

  const testerMap = new Map(testerDocs.map((item) => [String(item._id), item]));
  const testerActivity = testerActivityAgg.map((item) => {
    const tester = testerMap.get(String(item._id));
    return {
      testerId: String(item._id),
      name: tester?.name || 'Unknown',
      email: tester?.email || '',
      totalTests: item.totalTests,
      passCount: item.passCount,
      failCount: item.failCount,
      blockedCount: item.blockedCount,
    };
  });

  const projectDocs = await Project.find(resolvedProjectEntityId ? { entityId: resolvedProjectEntityId, deletedAt: null } : { deletedAt: null })
    .lean();

  const projectOverview = await Promise.all(
    projectDocs.map(async (project) => {
      const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
      const projectIds = Array.from(new Set(
        projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
      ));
      const latestVersion = await Version.findOne({ entityId: project.entityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
      const projectRuns = await TestRun.aggregate([
        { $match: { project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } } },
        {
          $project: {
            total: { $size: '$results' },
            passCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'pass'] },
                },
              },
            },
            failCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'fail'] },
                },
              },
            },
          },
        },
      ]);

      const totalTests = projectRuns.reduce((acc, run) => acc + run.total, 0);
      const passCount = projectRuns.reduce((acc, run) => acc + run.passCount, 0);
      const failCount = projectRuns.reduce((acc, run) => acc + run.failCount, 0);
      const executed = passCount + failCount;
      const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
      const progress = totalTests > 0 ? Number(((executed / totalTests) * 100).toFixed(2)) : 0;

      return {
        _id: String(project._id),
        name: project.name,
        code: project.code,
        latestVersion: latestVersion ? latestVersion.name : 'N/A',
        passCount,
        failCount,
        passRate,
        progress,
      };
    })
  );

  res.json({
    summary,
    runs,
    runningTestRuns,
    delayedTestPlans: delayedPlans,
    mostFailedTestCases,
    testerActivity,
    projectOverview,
  });
});

// Dashboard API endpoints
const getProjectDashboard = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    status: 'active',
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
  
  const projectStats = await Promise.all(
    projects.map(async (project) => {
      const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
      const projectIds = Array.from(new Set(
        projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
      ));

      const latestVersion = await Version.findOne({ entityId: project.entityId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();
      
      const runs = await TestRun.aggregate([
        { $match: { project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } } },
        {
          $project: {
            total: { $size: '$results' },
            passCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'pass'] },
                },
              },
            },
            failCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'fail'] },
                },
              },
            },
            updatedAt: 1,
          },
        },
      ]);

      const totalTests = runs.reduce((acc, run) => acc + run.total, 0);
      const passCount = runs.reduce((acc, run) => acc + run.passCount, 0);
      const failCount = runs.reduce((acc, run) => acc + run.failCount, 0);
      const executed = passCount + failCount;
      const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
      
      const lastUpdated = runs.length > 0 
        ? runs.reduce((latest, run) => 
            run.updatedAt && (!latest || new Date(run.updatedAt) > new Date(latest)) 
              ? run.updatedAt 
              : latest, null)
        : project.updatedAt;

      return {
        _id: String(project._id),
        name: project.name,
        code: project.code,
        latestVersion: latestVersion ? latestVersion.name : 'N/A',
        passRate,
        totalTests,
        failCount,
        lastUpdated,
      };
    })
  );

  res.json({ projects: projectStats });
});

const getVersionDashboard = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  
  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const projectDoc = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!projectDoc) {
    res.json({ versions: [] });
    return;
  }

  const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
  const projectIds = Array.from(new Set(
    projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
  ));

  const versions = await Version.find({ project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) }, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();
  const versionStats = await Promise.all(
    versions.map(async (version) => {
      const versionRefs = await Version.find({ entityId: version.entityId }).select('_id entityId').lean();
      const versionIds = Array.from(new Set(
        versionRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
      ));

      const testPlans = await TestPlan.find({ version: { $in: versionIds.map((value) => toObjectId(value, 'versionId')) } }).lean();
      const totalTestPlans = testPlans.length;
      
      const runs = await TestRun.aggregate([
        { $match: { version: { $in: versionIds.map((value) => toObjectId(value, 'versionId')) } } },
        {
          $project: {
            total: { $size: '$results' },
            passCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'pass'] },
                },
              },
            },
            failCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'fail'] },
                },
              },
            },
            notRunCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $in: ['$$r.status', ['untested', 'skip']] },
                },
              },
            },
          },
        },
      ]);

      const totalTests = runs.reduce((acc, run) => acc + run.total, 0);
      const passCount = runs.reduce((acc, run) => acc + run.passCount, 0);
      const failCount = runs.reduce((acc, run) => acc + run.failCount, 0);
      const notRunCount = runs.reduce((acc, run) => acc + run.notRunCount, 0);
      const executed = passCount + failCount;
      const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
      const progress = totalTests > 0 ? Number((((totalTests - notRunCount) / totalTests) * 100).toFixed(2)) : 0;

      return {
        _id: String(version._id),
        name: version.name,
        project: String(version.project),
        totalTestPlans,
        totalTests,
        passCount,
        failCount,
        notRunCount,
        progress,
        passRate,
      };
    })
  );

  res.json({ versions: versionStats });
});

const getTestPlanStats = asyncHandler(async (req, res) => {
  const { versionId } = req.query;
  
  if (!versionId) {
    throw httpError(400, 'versionId is required');
  }
  const versionDoc = await Version.findOne({
    entityId: toObjectId(versionId, 'versionId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!versionDoc) {
    res.json({ testPlans: [] });
    return;
  }

  const testPlans = await TestPlan.find({
    version: versionDoc._id,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  const testPlanStats = await Promise.all(
    testPlans.map(async (testPlan) => {
      const runs = await TestRun.find({ testPlan: testPlan._id })
        .sort({ createdAt: -1 })
        .lean();

      const latestRun = runs[0];
      let progress = 0;
      let passRate = 0;
      let lastRunTime;

      if (latestRun) {
        const total = latestRun.results.length;
        const passCount = latestRun.results.filter(r => r.status === 'pass').length;
        const executed = latestRun.results.filter(r => !['untested', 'skip'].includes(r.status)).length;
        
        progress = total > 0 ? Number(((executed / total) * 100).toFixed(2)) : 0;
        passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
        lastRunTime = latestRun.startedAt;
      }

      return {
        _id: String(testPlan._id),
        name: testPlan.name,
        owner: testPlan.owner,
        assignees: testPlan.assignees,
        progress,
        passRate,
        lastRunTime,
        status: latestRun ? latestRun.status : 'not_started',
      };
    })
  );

  res.json({ testPlans: testPlanStats });
});

const getTestPlanDetail = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  
  const testPlan = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') })
    .populate('project', 'name code')
    .populate('version', 'name')
    .lean();

  if (!testPlan) {
    // Return empty detail when not found instead of 404
    return res.json({
      testPlanId: null,
      testPlanName: null,
      version: null,
      project: null,
      summary: { totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0 },
      runHistory: [],
      insights: { stillFailing: [], failedThenPassed: [], flakyTests: [], notRun: [] },
      testCases: [],
    });
  }

  const runs = await TestRun.find({ testPlan: testPlan._id })
    .sort({ createdAt: 1 })
    .populate('startedBy', 'name email')
    .populate('endedBy', 'name email')
    .populate('results.tester', 'name email')
    .lean();

  const runHistory = runs.map(run => {
    const passCount = run.results.filter(r => r.status === 'pass').length;
    const failCount = run.results.filter(r => r.status === 'fail').length;
    const blockedCount = run.results.filter(r => r.status === 'blocked').length;
    const notRunCount = run.results.filter(r => ['untested', 'skip'].includes(r.status)).length;

    return {
      runId: String(run._id),
      runName: run.name,
      passCount,
      failCount,
      blockedCount,
      notRunCount,
      executedAt: run.startedAt,
    };
  });

  const latestRun = runs[runs.length - 1];
  let summary = {
    totalTests: 0,
    passCount: 0,
    failCount: 0,
    notRunCount: 0,
    passRate: 0,
    progress: 0,
  };

  if (latestRun) {
    summary.totalTests = latestRun.results.length;
    summary.passCount = latestRun.results.filter(r => r.status === 'pass').length;
    summary.failCount = latestRun.results.filter(r => r.status === 'fail').length;
    summary.notRunCount = latestRun.results.filter(r => ['untested', 'skip'].includes(r.status)).length;
    const executed = summary.passCount + summary.failCount + latestRun.results.filter(r => r.status === 'blocked').length;
    summary.passRate = executed > 0 ? Number(((summary.passCount / executed) * 100).toFixed(2)) : 0;
    summary.progress = summary.totalTests > 0 ? Number(((executed / summary.totalTests) * 100).toFixed(2)) : 0;
  }

  // Build execution history for each test case
  const testCaseExecutions = {};
  
  runs.forEach(run => {
    run.results.forEach(result => {
      const testCaseId = String(result.testCase);
      if (!testCaseExecutions[testCaseId]) {
        testCaseExecutions[testCaseId] = [];
      }
      testCaseExecutions[testCaseId].push(result.status);
    });
  });

  // Categorize test cases into insights
  const insights = {
    stillFailing: [],
    failedThenPassed: [],
    flakyTests: [],
    notRun: [],
  };

  const testCases = await TestPlan.findOne({ _id: testPlan._id })
    .populate('items.testCase', 'caseKey title priority')
    .populate('items.owner', 'name email')
    .populate('items.assignees', 'name email')
    .lean();

  const testCaseDetails = [];

  for (const item of testCases.items || []) {
    const testCase = item.testCase;
    if (!testCase) continue;

    const testCaseId = String(testCase._id);
    const history = testCaseExecutions[testCaseId] || [];
    const currentStatus = history.length > 0 ? history[history.length - 1] : 'untested';
    const failCount = history.filter(s => s === 'fail').length;

    const testCaseDetail = {
      testCaseId,
      caseKey: testCase.caseKey,
      title: testCase.title,
      priority: testCase.priority || 'medium',
      currentStatus,
      failCount,
      executionHistory: history,
      lastTester: latestRun?.results.find(r => String(r.testCase) === testCaseId)?.tester,
      lastRunTime: latestRun?.startedAt,
    };

    testCaseDetails.push(testCaseDetail);

    // Categorize into insights
    if (currentStatus === 'fail') {
      insights.stillFailing.push(testCaseDetail);
    } else if (currentStatus === 'pass' && failCount > 0) {
      // Check if it failed then passed (pattern: fail...pass)
      const hasFailThenPass = history.some((s, i) => s === 'fail' && i < history.length - 1 && history.slice(i + 1).includes('pass'));
      if (hasFailThenPass) {
        insights.failedThenPassed.push(testCaseDetail);
      }
    } else if (failCount >= 2 && currentStatus !== 'fail') {
      // Flaky: failed at least twice but not currently failing
      insights.flakyTests.push(testCaseDetail);
    } else if (['untested', 'skip'].includes(currentStatus)) {
      insights.notRun.push(testCaseDetail);
    }
  }

  const response = {
    testPlanId: String(testPlan._id),
    testPlanName: testPlan.name,
    version: testPlan.version.name,
    project: testPlan.project.name,
    summary,
    runHistory,
    insights,
    testCases: testCaseDetails,
  };

  res.json(response);
});

module.exports = {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  createVersion,
  listVersions,
  createTestCaseGroup,
  listTestCaseGroups,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  listTestCases,
  createTestPlan,
  listTestPlans,
  assignTestPlanItems,
  updateTestPlan,
  startTestRun,
  listTestRuns,
  getMyRunItems,
  updateRunResult,
  applyAutomationResults,
  endTestRun,
  getDashboard,
  getProjectDashboard,
  getVersionDashboard,
  getTestPlanStats,
  getTestPlanDetail,
};
