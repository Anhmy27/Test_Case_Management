const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  createProjectService,
  listProjectsService,
  getProjectService,
  updateProjectService,
  deleteProjectService,
  restoreProjectService,
} = require('../services/projectVersionServices');

const createProject = asyncHandler(async (req, res) => {
  const project = await createProjectService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'project.create',
    resourceType: 'project',
    ...pickEntityAuditFields(project),
  });
  res.status(201).json({ project });
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await listProjectsService(req.query || {});
  res.json({ projects });
});

const getProject = asyncHandler(async (req, res) => {
  const project = await getProjectService(req.params.projectId);
  res.json({ project: project || null });
});

const updateProject = asyncHandler(async (req, res) => {
  const project = await updateProjectService(req.params.projectId, req.body || {});
  await auditFromRequest(req, {
    action: 'project.update',
    resourceType: 'project',
    ...pickEntityAuditFields(project),
  });
  res.json({ project });
});

const deleteProject = asyncHandler(async (req, res) => {
  await deleteProjectService(req.params.projectId);
  await auditFromRequest(req, {
    action: 'project.delete',
    resourceType: 'project',
    resourceId: req.params.projectId,
  });
  res.status(204).send();
});

const restoreProject = asyncHandler(async (req, res) => {
  const project = await restoreProjectService(req.params.projectId);
  await auditFromRequest(req, {
    action: 'project.restore',
    resourceType: 'project',
    ...pickEntityAuditFields(project),
  });
  res.json({ project });
});

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  restoreProject,
};
