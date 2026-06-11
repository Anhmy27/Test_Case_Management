/**
 * Live end-to-end: logBugService must return a real Jira issueKey.
 *
 * Run:
 *   node --test test/jira-log-bug-live.test.js
 */
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const JiraAccount = require('../src/models/JiraAccount');
const Project = require('../src/models/Project');
const { logBugService } = require('../src/services/jiraManagementService');

const hasJiraEnv = Boolean(
  process.env.MONGO_URI
  && String(process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').trim()
  && String(process.env.JIRA_USERNAME || '').trim()
  && String(process.env.JIRA_PASSWORD || '').trim(),
);

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/;

async function connectMongo() {
  const mongoUri = String(process.env.MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing');
  }
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(mongoUri);
}

async function findUserWithJiraProfile() {
  const account = await JiraAccount.findOne({
    profileType: 'user',
    isActive: { $ne: false },
    jiraUsername: { $exists: true, $ne: '' },
  }).lean();

  if (!account?.userId) {
    return null;
  }

  const user = await User.findById(account.userId).lean();
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    username: user.username,
    jiraUsername: account.jiraUsername,
  };
}

async function findProjectForProbe() {
  const probePid = String(process.env.JIRA_PROBE_PID || '11202').trim();
  const probeProjectId = String(process.env.JIRA_PROBE_PROJECT_ID || '').trim();

  if (probeProjectId && mongoose.Types.ObjectId.isValid(probeProjectId)) {
    const byId = await Project.findOne({
      $and: [
        { $or: [{ entityId: probeProjectId }, { _id: probeProjectId }] },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
        { deletedAt: null },
      ],
    }).lean();
    if (byId) {
      return byId;
    }
  }

  return Project.findOne({
    pid: probePid,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
}

test('live logBugService returns Jira issueKey via QuickCreate flow', { skip: !hasJiraEnv }, async () => {
  await connectMongo();

  const user = await findUserWithJiraProfile();
  assert.ok(user, 'Need at least one user with an active Jira profile in DB');

  const project = await findProjectForProbe();
  assert.ok(project, 'Need a project with Jira pid (set JIRA_PROBE_PID or JIRA_PROBE_PROJECT_ID)');
  assert.ok(project.pid, 'Project is missing Jira pid');

  const stamp = new Date().toISOString();
  const payload = {
    user: { id: user.id, _id: user.id, username: user.username },
    projectId: String(project.entityId || project._id),
    summary: `[TCM-PROBE] QuickCreate ${stamp}`,
    description: `Automated probe at ${stamp}\n\nCreated by jira-log-bug-live.test.js`,
    issueType: String(process.env.JIRA_PROBE_ISSUE_TYPE_ID || '10102'),
    priority: '3',
    assignee: '',
    timetracking_originalestimate: '',
    labels: '',
    versions: [],
  };

  console.log('[probe-log-bug] user:', user.username, `(${user.jiraUsername})`);
  console.log('[probe-log-bug] project:', project.name, 'pid=', project.pid);

  const apiResponse = await logBugService(payload);

  console.log('[probe-log-bug] api response:', apiResponse);

  assert.equal(apiResponse.message, 'Jira bug created');
  assert.ok(apiResponse.issueKey, 'API must return issueKey');
  assert.match(apiResponse.issueKey, ISSUE_KEY_PATTERN, `issueKey format invalid: ${apiResponse.issueKey}`);
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
