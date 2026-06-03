const { asyncHandler } = require('../utils/asyncHandler');
const {
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
} = require('../services/testManagementService');

const createVersion = asyncHandler(async (req, res) => {
  const version = await createVersionService({
    ...req.body,
    createdBy: req.user.id,
  });
  res.status(201).json({ version });
});

const listVersions = asyncHandler(async (req, res) => {
  const versions = await listVersionsService(req.query || {});
  res.json({ versions });
});

const getVersion = asyncHandler(async (req, res) => {
  const version = await getVersionService(req.params.versionId);
  res.json({ version });
});

const updateVersion = asyncHandler(async (req, res) => {
  const version = await updateVersionService(req.params.versionId, req.body || {});
  res.json({ version });
});

const deleteVersion = asyncHandler(async (req, res) => {
  await deleteVersionService(req.params.versionId);
  res.status(204).send();
});

const restoreVersion = asyncHandler(async (req, res) => {
  const version = await restoreVersionService(req.params.versionId);
  res.json({ version });
});

const createIssueType = asyncHandler(async (req, res) => {
  const issueType = await createIssueTypeService({
    ...req.body,
    createdBy: req.user.id,
  });
  res.status(201).json({ issueType });
});

const listIssueTypes = asyncHandler(async (req, res) => {
  const issueTypes = await listIssueTypesService(req.query || {});
  res.json({ issueTypes });
});

const getIssueType = asyncHandler(async (req, res) => {
  const issueType = await getIssueTypeService(req.params.issueTypeId);
  res.json({ issueType });
});

const updateIssueType = asyncHandler(async (req, res) => {
  const issueType = await updateIssueTypeService(req.params.issueTypeId, req.body || {});
  res.json({ issueType });
});

const deleteIssueType = asyncHandler(async (req, res) => {
  await deleteIssueTypeService(req.params.issueTypeId);
  res.status(204).send();
});

module.exports = {
  createVersion,
  listVersions,
  getVersion,
  updateVersion,
  deleteVersion,
  restoreVersion,
  createIssueType,
  listIssueTypes,
  getIssueType,
  updateIssueType,
  deleteIssueType,
};
