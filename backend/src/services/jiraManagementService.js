const mongoose = require('mongoose');
const Project = require('../models/Project');
const { httpError } = require('../utils/httpError');
const {
  createBugIssue,
  suggestLabels,
  suggestVersions,
  searchAssignableUsers,
} = require('./jiraService');
const { listLogBugsByProject, createLogBugRecord } = require('./logBugHistoryService');
const {
  getJiraProfileView,
  getUserJiraAccount,
  upsertUserJiraAccount,
} = require('./jiraAccountService');

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
  user,
  projectId,
  runId,
  resultId,
  caseKey,
  caseTitle,
  summary,
  description,
  issueType,
  priority,
  assignee,
  timetracking_originalestimate,
  originalEstimate,
  labels,
  versions,
}) => {
  const resolvedOriginalEstimate = String(
    timetracking_originalestimate ?? originalEstimate ?? '',
  ).trim();

  const project = await getProjectById(projectId);

  const created = await createBugIssue({
    pid: project.pid,
    issueTypeId: issueType,
    summary,
    description,
    priority,
    assignee,
    originalEstimate: resolvedOriginalEstimate,
    labels,
    versions,
    userId: user?.id || user?._id || null,
  });

  const logBug = await createLogBugRecord({
    projectObjectId: project._id,
    testRunId: runId,
    runResultId: resultId,
    caseKey,
    caseTitle,
    issueKeyJira: created.issueKey,
    summary,
    description,
    issueType,
    priority,
    assignee,
    labels,
    versions,
    jiraLocation: created.location,
    loggedByUserId: user?.id || user?._id || null,
  });

  return {
    message: 'Jira bug created',
    issueKey: created.issueKey,
    location: created.location,
    logBugId: String(logBug._id),
  };
};

const getAssignableUsersService = async ({
  user,
  projectKeys, projectKey, username = '', maxResults = '100',
}) => {
  const resolvedProjectKeys = String(projectKeys || projectKey || '').trim();

  const users = await searchAssignableUsers({
    projectKeys: resolvedProjectKeys,
    username: String(username || ''),
    maxResults: Number(maxResults) || 100,
    userId: user?.id || user?._id || null,
  });

  return { users };
};

const getLabelSuggestionsService = async ({ query = '', user } = {}) => {
  const labels = await suggestLabels({
    query: String(query || ''),
    userId: user?.id || user?._id || null,
  });
  return {
    suggestions: labels.map((label) => ({ label })),
  };
};

const getVersionSuggestionsService = async ({
  user,
  projectId,
  query = '',
  maxResults = '100',
  startAt = '0',
} = {}) => {
  const project = await getProjectById(projectId);
  const versions = await suggestVersions({
    projectIds: String(project.pid || ''),
    query: String(query || ''),
    maxResults: Number(maxResults) || 100,
    startAt: Number(startAt) || 0,
    userId: user?.id || user?._id || null,
  });

  return {
    suggestions: versions.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
    })),
  };
};

const getJiraProfileService = async (user) => {
  const account = await getUserJiraAccount(user?.id || user?._id || null);
  return { profile: getJiraProfileView(account) };
};

const upsertJiraProfileService = async (user, payload = {}) => {
  const account = await upsertUserJiraAccount({
    userId: user?.id || user?._id || null,
    jiraUsername: payload.jiraUsername,
    jiraPassword: payload.jiraPassword,
  });

  return { profile: getJiraProfileView(account) };
};

const listLogBugsService = async ({
  projectId,
  page,
  limit,
  search,
  priority,
  issueType,
}) => {
  const project = await getProjectById(projectId);
  return listLogBugsByProject({
    projectObjectId: project._id,
    page,
    limit,
    search,
    priority,
    issueType,
  });
};

module.exports = {
  logBugService,
  getAssignableUsersService,
  getLabelSuggestionsService,
  getVersionSuggestionsService,
  getJiraProfileService,
  upsertJiraProfileService,
  listLogBugsService,
};
