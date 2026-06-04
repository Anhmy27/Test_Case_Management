const mongoose = require('mongoose');
const Project = require('../models/Project');
const { httpError } = require('../utils/httpError');
const {
  createBugIssue,
  suggestLabels,
  suggestVersions,
  searchAssignableUsers,
} = require('./jiraService');

const getProjectById = async (projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw httpError(400, 'projectId is invalid');
  }

  const objectId = new mongoose.Types.ObjectId(projectId);
  const project = await Project.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      { deletedAt: null },
    ],
  }).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  if (!project.pid) {
    throw httpError(400, 'Project is missing Jira pid');
  }

  return project;
};

const logBugService = async ({
  projectId,
  summary,
  description,
  issueType,
  priority,
  assignee,
  labels,
  versions,
}) => {
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
    versions,
  });

  console.log('[Jira] logBug created', {
    issueKey: created.issueKey,
    location: created.location,
    status: created.status,
  });

  return {
    message: 'Jira bug created',
    issueKey: created.issueKey,
    location: created.location,
  };
};

const getAssignableUsersService = async ({
  projectKeys, projectKey, username = '', maxResults = '100',
}) => {
  const resolvedProjectKeys = String(projectKeys || projectKey || '').trim();
  if (!resolvedProjectKeys) {
    throw httpError(400, 'projectKeys is required');
  }

  const users = await searchAssignableUsers({
    projectKeys: resolvedProjectKeys,
    username: String(username || ''),
    maxResults: Number(maxResults) || 100,
  });

  return { users };
};

const getLabelSuggestionsService = async ({ query = '' } = {}) => {
  const labels = await suggestLabels({ query: String(query || '') });
  return {
    suggestions: labels.map((label) => ({ label })),
  };
};

const getVersionSuggestionsService = async ({
  projectId,
  query = '',
  maxResults = '100',
  startAt = '0',
} = {}) => {
  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const project = await getProjectById(projectId);
  const versions = await suggestVersions({
    projectIds: String(project.pid || ''),
    query: String(query || ''),
    maxResults: Number(maxResults) || 100,
    startAt: Number(startAt) || 0,
  });

  return {
    suggestions: versions.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
    })),
  };
};

module.exports = {
  logBugService,
  getAssignableUsersService,
  getLabelSuggestionsService,
  getVersionSuggestionsService,
};
