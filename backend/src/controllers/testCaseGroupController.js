const { asyncHandler } = require('../utils/asyncHandler');
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
  res.json({ group });
});

const deleteTestCaseGroup = asyncHandler(async (req, res) => {
  await deleteTestCaseGroupService(req.params.groupId);
  res.status(204).send();
});

const restoreTestCaseGroup = asyncHandler(async (req, res) => {
  const group = await restoreTestCaseGroupService(req.params.groupId);
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
