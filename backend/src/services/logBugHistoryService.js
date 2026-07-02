const mongoose = require('mongoose');
const LogBug = require('../models/LogBug');
const TestRun = require('../models/TestRun');
const { buildJiraBrowseUrl } = require('./jiraService');
const { httpError } = require('../utils/httpError');

const normalizeLabels = (labels) => {
  if (Array.isArray(labels)) {
    return labels.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  }
  return String(labels || '').trim();
};

const normalizeVersions = (versions) => {
  if (Array.isArray(versions)) {
    return versions.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const raw = String(versions || '').trim();
  if (!raw) {
    return [];
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
};

const resolveRunContext = async ({ projectObjectId, testRunId, runResultId }) => {
  const runId = String(testRunId || '').trim();
  if (!runId) {
    return { testRun: null, runResult: null, caseKey: '', caseTitle: '' };
  }

  if (!mongoose.Types.ObjectId.isValid(runId)) {
    throw httpError(400, 'testRunId is invalid');
  }

  const testRun = await TestRun.findById(runId)
    .populate('results.testCase', 'caseKey title')
    .lean();
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const runProjectId = testRun.project?._id || testRun.project;
  if (String(runProjectId) !== String(projectObjectId)) {
    throw httpError(400, 'Test run does not belong to this project');
  }

  const resultId = String(runResultId || '').trim();
  if (!resultId) {
    return { testRun, runResult: null, caseKey: '', caseTitle: '' };
  }

  if (!mongoose.Types.ObjectId.isValid(resultId)) {
    throw httpError(400, 'runResultId is invalid');
  }

  const results = Array.isArray(testRun.results) ? testRun.results : [];
  const runResult = results.find((item) => String(item._id) === resultId);
  if (!runResult) {
    throw httpError(404, 'Run result not found');
  }

  return {
    testRun,
    runResult,
    caseKey: String(runResult?.testCase?.caseKey || '').trim(),
    caseTitle: String(runResult?.testCase?.title || '').trim(),
  };
};

const createLogBugRecord = async ({
  projectObjectId,
  testRunId,
  runResultId,
  caseKey,
  caseTitle,
  issueKeyJira,
  summary,
  description,
  issueType,
  priority,
  assignee,
  labels,
  versions,
  loggedByUserId,
}) => {
  const issueKey = String(issueKeyJira || '').trim();
  if (!issueKey) {
    throw httpError(500, 'Jira issue key is missing');
  }

  const runContext = await resolveRunContext({
    projectObjectId,
    testRunId,
    runResultId,
  });

  return LogBug.create({
    project: projectObjectId,
    testRun: runContext.testRun?._id || null,
    runResult: runContext.runResult?._id || null,
    issueKeyJira: issueKey,
    summary: String(summary || '').trim(),
    description: String(description || '').trim(),
    issueType: String(issueType || '').trim(),
    priority: String(priority || '').trim(),
    assignee: String(assignee || '').trim(),
    labels: normalizeLabels(labels),
    versions: normalizeVersions(versions),
    caseKey: runContext.caseKey || String(caseKey || '').trim(),
    caseTitle: runContext.caseTitle || String(caseTitle || '').trim(),
    loggedBy: loggedByUserId,
  });
};

const listLogBugsByProject = async ({
  projectObjectId,
  page = 1,
  limit = 50,
  search = '',
  priority = '',
  issueType = '',
}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (safePage - 1) * safeLimit;

  const filter = { project: projectObjectId };
  const priorityTerm = String(priority || '').trim();
  if (priorityTerm) {
    filter.priority = priorityTerm;
  }

  const issueTypeTerm = String(issueType || '').trim();
  if (issueTypeTerm) {
    filter.issueType = issueTypeTerm;
  }

  const term = String(search || '').trim();
  if (term) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { issueKeyJira: regex },
      { summary: regex },
      { caseKey: regex },
      { caseTitle: regex },
      { assignee: regex },
    ];
  }

  const [items, total] = await Promise.all([
    LogBug.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('loggedBy', 'name email role')
      .populate('testRun', 'name status')
      .lean(),
    LogBug.countDocuments(filter),
  ]);

  return {
    logBugs: items.map((entry) => ({
      _id: String(entry._id),
      project: String(entry.project),
      testRun: entry.testRun
        ? {
            _id: String(entry.testRun._id),
            name: entry.testRun.name || '',
            status: entry.testRun.status || '',
          }
        : null,
      runResult: entry.runResult ? String(entry.runResult) : '',
      issueKeyJira: entry.issueKeyJira,
      jiraBrowseUrl: buildJiraBrowseUrl(entry.issueKeyJira),
      summary: entry.summary,
      description: entry.description,
      issueType: entry.issueType,
      priority: entry.priority,
      assignee: entry.assignee,
      labels: entry.labels,
      versions: Array.isArray(entry.versions) ? entry.versions : [],
      caseKey: entry.caseKey,
      caseTitle: entry.caseTitle,
      loggedBy: entry.loggedBy
        ? {
            _id: String(entry.loggedBy._id),
            name: entry.loggedBy.name || '',
            email: entry.loggedBy.email || '',
            role: entry.loggedBy.role || '',
          }
        : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

module.exports = {
  createLogBugRecord,
  listLogBugsByProject,
};
