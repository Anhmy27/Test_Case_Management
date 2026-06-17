const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  createTestCaseGroupService,
  listTestCaseGroupsService,
  getTestCaseGroupService,
  getTestCaseGroupVersionsService,
  updateTestCaseGroupService,
  deleteTestCaseGroupService,
  restoreTestCaseGroupService,
} = require('../services/issueTypeGroupServices');

const createTestCaseGroup = asyncHandler(async (req, res) => {
  const group = await createTestCaseGroupService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'test_case_group.create',
    resourceType: 'test_case_group',
    ...pickEntityAuditFields(group, { labelKeys: ['name', 'key'] }),
    projectId: String(req.body?.projectId || group?.project || ''),
  });
  res.status(201).json({ group });
});

const listTestCaseGroups = asyncHandler(async (req, res) => {
  const result = await listTestCaseGroupsService({
    query: req.query || {},
    projectId: req.query?.projectId,
    search: req.query?.search,
    includeDeleted: req.query?.includeDeleted,
  });
  res.json(result);
});

const getTestCaseGroup = asyncHandler(async (req, res) => {
  const group = await getTestCaseGroupService(req.params.groupId);
  res.json({ group: group || null });
});

const getTestCaseGroupVersions = asyncHandler(async (req, res) => {
  const versions = await getTestCaseGroupVersionsService(req.params.groupId);
  res.json({ versions });
});

const updateTestCaseGroup = asyncHandler(async (req, res) => {
  const group = await updateTestCaseGroupService(req.params.groupId, req.body || {});
  await auditFromRequest(req, {
    action: 'test_case_group.update',
    resourceType: 'test_case_group',
    ...pickEntityAuditFields(group, { labelKeys: ['name', 'key'] }),
  });
  res.json({ group });
});

const deleteTestCaseGroup = asyncHandler(async (req, res) => {
  await deleteTestCaseGroupService(req.params.groupId);
  await auditFromRequest(req, {
    action: 'test_case_group.delete',
    resourceType: 'test_case_group',
    resourceId: req.params.groupId,
    projectId: String(req.body?.projectId || req.query?.projectId || ''),
  });
  res.status(204).send();
});

const restoreTestCaseGroup = asyncHandler(async (req, res) => {
  const group = await restoreTestCaseGroupService(req.params.groupId);
  await auditFromRequest(req, {
    action: 'test_case_group.restore',
    resourceType: 'test_case_group',
    ...pickEntityAuditFields(group, { labelKeys: ['name', 'key'] }),
  });
  res.json({ group });
});

module.exports = {
  createTestCaseGroup,
  listTestCaseGroups,
  getTestCaseGroup,
  getTestCaseGroupVersions,
  updateTestCaseGroup,
  deleteTestCaseGroup,
  restoreTestCaseGroup,
};
