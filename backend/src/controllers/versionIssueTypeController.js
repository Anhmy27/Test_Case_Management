const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  createVersionService,
  listVersionsService,
  getVersionService,
  updateVersionService,
  deleteVersionService,
  restoreVersionService,
} = require('../services/projectVersionServices');
const {
  createIssueTypeService,
  listIssueTypesService,
  getIssueTypeService,
  updateIssueTypeService,
  deleteIssueTypeService,
} = require('../services/issueTypeGroupServices');

const createVersion = asyncHandler(async (req, res) => {
  const version = await createVersionService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'version.create',
    resourceType: 'version',
    ...pickEntityAuditFields(version),
    projectId: String(req.body?.projectId || version?.project || ''),
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
  await auditFromRequest(req, {
    action: 'version.update',
    resourceType: 'version',
    ...pickEntityAuditFields(version),
  });
  res.json({ version });
});

const deleteVersion = asyncHandler(async (req, res) => {
  await deleteVersionService(req.params.versionId);
  await auditFromRequest(req, {
    action: 'version.delete',
    resourceType: 'version',
    resourceId: req.params.versionId,
  });
  res.status(204).send();
});

const restoreVersion = asyncHandler(async (req, res) => {
  const version = await restoreVersionService(req.params.versionId);
  await auditFromRequest(req, {
    action: 'version.restore',
    resourceType: 'version',
    ...pickEntityAuditFields(version),
  });
  res.json({ version });
});

const createIssueType = asyncHandler(async (req, res) => {
  const issueType = await createIssueTypeService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'issue_type.create',
    resourceType: 'issue_type',
    ...pickEntityAuditFields(issueType, { labelKeys: ['name', 'code'] }),
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
  await auditFromRequest(req, {
    action: 'issue_type.update',
    resourceType: 'issue_type',
    ...pickEntityAuditFields(issueType, { labelKeys: ['name', 'code'] }),
  });
  res.json({ issueType });
});

const deleteIssueType = asyncHandler(async (req, res) => {
  await deleteIssueTypeService(req.params.issueTypeId);
  await auditFromRequest(req, {
    action: 'issue_type.delete',
    resourceType: 'issue_type',
    resourceId: req.params.issueTypeId,
  });
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
