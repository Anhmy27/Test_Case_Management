const mongoose = require('mongoose');
const Project = require('../models/Project');
const { asyncHandler } = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { createBugIssue } = require('../services/jiraService');

const getProjectById = async (projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw httpError(400, 'projectId is invalid');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  if (!project.pid) {
    throw httpError(400, 'Project is missing Jira pid');
  }

  return project;
};

const logBug = asyncHandler(async (req, res) => {
  const {
    projectId,
    summary,
    description,
    issueType,
    priority,
    assignee,
    labels,
  } = req.body;

  if (!projectId || !summary || !description || !issueType) {
    throw httpError(400, 'projectId, summary, description and issueType are required');
  }

  console.log('[Jira] logBug request received', {
    projectId,
    issueType,
    priority: priority || '3',
    hasAssignee: Boolean(assignee),
    labels: labels || '',
  });

  const project = await getProjectById(projectId);
  console.log('[Jira] project resolved', {
    projectId: project._id,
    pid: project.pid,
  });

  const created = await createBugIssue({
    pid: project.pid,
    issueTypeId: issueType,
    summary,
    description,
    priority,
    assignee,
    labels,
  });

  console.log('[Jira] logBug created', {
    issueKey: created.issueKey,
    location: created.location,
    status: created.status,
  });

  res.status(201).json({
    message: 'Jira bug created',
    issueKey: created.issueKey,
    location: created.location,
  });
});

module.exports = {
  logBug,
};