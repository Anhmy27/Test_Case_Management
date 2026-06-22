/**
 * Seed 5 public-site automation demo cases + optional stability probe.
 *
 * Usage (from backend/):
 *   npm run automation:seed-demos              # seed + probe 3 runs each
 *   npm run automation:seed-demos -- --seed-only
 *   npm run automation:seed-demos -- --probe-only --runs 10
 */

require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Version = require('../src/models/Version');
const TestCaseGroup = require('../src/models/TestCaseGroup');
const TestCase = require('../src/models/TestCase');
const { connectDatabase } = require('../src/config/db');
const { createEntityId } = require('../src/utils/versioning');
const { dryRunAutomationService } = require('../src/services/automation/dryRunService');

const DEMO_PROJECT_CODE = 'AUTODEMO';
const DEMO_PROJECT_NAME = 'Automation Web Demos';
const DEMO_VERSION_NAME = 'Demo v1';
const DEMO_GROUP_KEY = 'AUTODEMO';
const DEMO_GROUP_NAME = 'Public Site Demos';

const PROBE_USER = {
  id: 'automation-demo-seed',
  name: 'Demo Seed',
  email: 'demo-seed@local',
  role: 'admin',
};

const DEMO_CASES = [
  {
    caseKey: 'DEMO-EX01',
    title: 'Example.com — title and footer link',
    description: 'Trang tĩnh example.com — kiểm tra title và nội dung body.',
    baseUrl: 'https://example.com',
    webId: 'demo-example',
    steps: [
      { order: 1, stepName: 'Open home', action: 'goto', targetType: 'url', value: '/', timeoutMs: 20000 },
      { order: 2, stepName: 'Title contains Example Domain', action: 'assertTitle', targetType: 'css', expected: 'Example Domain', timeoutMs: 15000 },
      { order: 3, stepName: 'Body mentions documentation', action: 'assertText', targetType: 'css', expected: 'documentation examples', timeoutMs: 15000 },
    ],
  },
  {
    caseKey: 'DEMO-INET',
    title: 'The Internet — examples home',
    description: 'Herokuapp demo site — danh sách examples.',
    baseUrl: 'https://the-internet.herokuapp.com',
    webId: 'demo-internet',
    steps: [
      { order: 1, stepName: 'Open home', action: 'goto', targetType: 'url', value: '/', timeoutMs: 25000 },
      { order: 2, stepName: 'Page title', action: 'assertTitle', targetType: 'css', expected: 'The Internet', timeoutMs: 15000 },
      { order: 3, stepName: 'Examples heading', action: 'assertText', targetType: 'css', expected: 'Available Examples', timeoutMs: 15000 },
    ],
  },
  {
    caseKey: 'DEMO-HTTP',
    title: 'httpbin — HTML sample',
    description: 'httpbin.org/html — trích đoạn Moby Dick.',
    baseUrl: 'https://httpbin.org',
    webId: 'demo-httpbin',
    steps: [
      { order: 1, stepName: 'Open /html', action: 'goto', targetType: 'url', value: '/html', timeoutMs: 30000 },
      { order: 2, stepName: 'Wait heading', action: 'waitFor', targetType: 'css', target: 'h1', timeoutMs: 20000 },
      { order: 3, stepName: 'Author name in body', action: 'assertText', targetType: 'css', expected: 'Melville', timeoutMs: 15000 },
    ],
  },
  {
    caseKey: 'DEMO-WIKI',
    title: 'Wikipedia — portal title',
    description: 'wikipedia.org — title trang chủ đa ngôn ngữ.',
    baseUrl: 'https://www.wikipedia.org',
    webId: 'demo-wiki',
    steps: [
      { order: 1, stepName: 'Open portal', action: 'goto', targetType: 'url', value: '/', timeoutMs: 30000 },
      { order: 2, stepName: 'Title contains Wikipedia', action: 'assertTitle', targetType: 'css', expected: 'Wikipedia', timeoutMs: 20000 },
      { order: 3, stepName: 'Search input visible', action: 'assertVisible', targetType: 'css', target: '#searchInput', timeoutMs: 20000 },
    ],
  },
  {
    caseKey: 'DEMO-TODO',
    title: 'Playwright TodoMVC — add todo',
    description: 'demo.playwright.dev/todomvc — thêm 1 todo item.',
    baseUrl: 'https://demo.playwright.dev',
    webId: 'demo-todo',
    steps: [
      { order: 1, stepName: 'Open TodoMVC', action: 'goto', targetType: 'url', value: '/todomvc/#/', timeoutMs: 30000 },
      { order: 2, stepName: 'Wait input', action: 'waitFor', targetType: 'placeholder', target: 'What needs to be done?', timeoutMs: 20000 },
      { order: 3, stepName: 'Type todo', action: 'type', targetType: 'placeholder', target: 'What needs to be done?', value: 'Learn Playwright', timeoutMs: 15000 },
      { order: 4, stepName: 'Submit Enter', action: 'press', targetType: 'css', target: '.new-todo', value: 'Enter', timeoutMs: 10000 },
      { order: 5, stepName: 'Todo visible', action: 'assertText', targetType: 'css', expected: 'Learn Playwright', timeoutMs: 15000 },
    ],
  },
];

const parseArgs = (argv) => ({
  seedOnly: argv.includes('--seed-only'),
  probeOnly: argv.includes('--probe-only'),
  runs: (() => {
    const index = argv.indexOf('--runs');
    if (index === -1 || !argv[index + 1]) return 3;
    return Math.max(1, Number(argv[index + 1]) || 3);
  })(),
});

const activeLatestFilter = () => ({
  deletedAt: null,
  $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
});

async function resolveAdminUser() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  let user = await User.findOne({ email }).lean();
  if (!user) {
    user = await User.findOne({ role: 'admin' }).lean();
  }
  if (!user) {
    throw new Error('No admin user in DB. Run npm run seed:admin first.');
  }
  return user;
}

async function ensureDemoProject(adminId) {
  let project = await Project.findOne({
    code: DEMO_PROJECT_CODE,
    ...activeLatestFilter(),
  }).lean();

  if (!project) {
    const created = await Project.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      name: DEMO_PROJECT_NAME,
      code: DEMO_PROJECT_CODE,
      description: 'Demo automation cases against public websites',
      status: 'active',
      createdBy: adminId,
    });
    project = created.toObject();
    console.log(`Created project: ${DEMO_PROJECT_NAME} (${DEMO_PROJECT_CODE})`);
  } else {
    console.log(`Using project: ${project.name}`);
  }

  return project;
}

async function ensureDemoVersion(project, adminId) {
  const projectRef = project.entityId || project._id;

  let version = await Version.findOne({
    project: projectRef,
    name: DEMO_VERSION_NAME,
    ...activeLatestFilter(),
  }).lean();

  if (!version) {
    const created = await Version.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      project: projectRef,
      projectVersionId: project._id,
      name: DEMO_VERSION_NAME,
      notes: 'Automation public site demos',
      status: 'active',
      createdBy: adminId,
    });
    version = created.toObject();
    console.log(`Created version: ${DEMO_VERSION_NAME}`);
  }

  return version;
}

async function ensureDemoGroup(project, adminId) {
  const projectRef = project.entityId || project._id;

  let group = await TestCaseGroup.findOne({
    project: projectRef,
    key: DEMO_GROUP_KEY,
    ...activeLatestFilter(),
  }).lean();

  if (!group) {
    const created = await TestCaseGroup.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      project: projectRef,
      projectVersionId: project._id,
      key: DEMO_GROUP_KEY,
      name: DEMO_GROUP_NAME,
      description: '5 demo cases — public websites',
      createdBy: adminId,
    });
    group = created.toObject();
    console.log(`Created group: ${DEMO_GROUP_NAME}`);
  } else {
    console.log(`Using group: ${group.name}`);
  }

  return group;
}

function buildAutomationPayload(demoCase) {
  return {
    enabled: true,
    runner: 'playwright',
    webId: demoCase.webId,
    userKey: 'demo',
    baseUrl: demoCase.baseUrl,
    timeoutMs: 45000,
    steps: demoCase.steps.map((step, index) => ({
      stepId: String(index + 1),
      stepName: step.stepName || `Step ${index + 1}`,
      order: step.order || index + 1,
      action: step.action,
      targetType: step.targetType || 'css',
      target: step.target || '',
      value: step.value || '',
      expected: step.expected || '',
      timeoutMs: step.timeoutMs || 15000,
    })),
  };
}

async function upsertDemoCase({ demoCase, project, group, adminId }) {
  const projectRef = project.entityId || project._id;
  const groupRef = group.entityId || group._id;
  const normalizedKey = String(demoCase.caseKey).trim().toUpperCase();

  const existing = await TestCase.findOne({
    group: groupRef,
    caseKey: normalizedKey,
    ...activeLatestFilter(),
  });

  const automation = buildAutomationPayload(demoCase);
  const manualSteps = demoCase.steps.map((step, index) => ({
    order: index + 1,
    action: step.stepName || step.action,
    expected: step.expected || step.value || 'OK',
  }));

  if (existing) {
    existing.title = demoCase.title;
    existing.name = demoCase.title;
    existing.description = demoCase.description || '';
    existing.steps = manualSteps;
    existing.automation = automation;
    await existing.save();
    console.log(`  Updated: ${normalizedKey}`);
    return existing.toObject();
  }

  const created = await TestCase.create({
    entityId: createEntityId(),
    versionNumber: 1,
    isLatest: true,
    deletedAt: null,
    project: projectRef,
    projectVersionId: project._id,
    group: groupRef,
    groupVersionId: group._id,
    key: normalizedKey,
    caseKey: normalizedKey,
    name: demoCase.title,
    title: demoCase.title,
    description: demoCase.description || '',
    expected: demoCase.title,
    steps: manualSteps,
    priority: 'medium',
    severity: 'minor',
    type: 'ui',
    automation,
    createdBy: adminId,
  });

  console.log(`  Created: ${normalizedKey}`);
  return created.toObject();
}

async function seedDemoCases() {
  const admin = await resolveAdminUser();
  const adminId = admin._id;

  const project = await ensureDemoProject(adminId);
  await ensureDemoVersion(project, adminId);
  const group = await ensureDemoGroup(project, adminId);

  console.log('\nSeeding 5 automation demo cases...');
  const saved = [];
  for (const demoCase of DEMO_CASES) {
    const doc = await upsertDemoCase({ demoCase, project, group, adminId });
    saved.push(doc);
  }

  console.log('\nDone. Case keys:');
  for (const item of saved) {
    console.log(`  - ${item.caseKey}  →  ${item.automation?.baseUrl || ''}`);
  }

  return saved.map((item) => item.caseKey);
}

async function probeCaseKeys(caseKeys, runs) {
  console.log(`\nProbing ${caseKeys.length} case(s), ${runs} run(s) each...\n`);

  for (const caseKey of caseKeys) {
    const testCase = await TestCase.findOne({
      caseKey: String(caseKey).trim().toUpperCase(),
      ...activeLatestFilter(),
    }).lean();

    if (!testCase) {
      console.log(`[SKIP] ${caseKey}: not found`);
      continue;
    }

    console.log(`--- ${testCase.caseKey} — ${testCase.title} ---`);
    const results = [];

    for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
      process.stdout.write(`  Run ${String(runIndex).padStart(2, ' ')}/${runs} ... `);
      const startedAt = Date.now();
      try {
        const result = await dryRunAutomationService({
          testCaseId: String(testCase.entityId || testCase._id),
          automation: testCase.automation,
          baseUrl: '',
          user: PROBE_USER,
        });
        const status = String(result.status || 'fail').toLowerCase();
        results.push(status);
        console.log(`${status.toUpperCase().padEnd(4)} ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      } catch (error) {
        results.push('error');
        console.log(`ERR  ${((Date.now() - startedAt) / 1000).toFixed(1)}s  ${String(error.message || '').slice(0, 80)}`);
      }
    }

    const passCount = results.filter((s) => s === 'pass').length;
    const consistent = new Set(results).size === 1;
    console.log(`  Pass: ${passCount}/${runs} | Consistent: ${consistent ? 'YES' : 'NO'}\n`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await connectDatabase();

  console.log('\n=== Automation Demo Cases (public websites) ===\n');

  let caseKeys = DEMO_CASES.map((item) => item.caseKey);

  if (!options.probeOnly) {
    caseKeys = await seedDemoCases();
  } else {
    caseKeys = (
      await TestCase.find({
        caseKey: { $in: DEMO_CASES.map((item) => item.caseKey) },
        ...activeLatestFilter(),
      }).lean()
    ).map((item) => item.caseKey);
  }

  if (!options.seedOnly && caseKeys.length > 0) {
    await probeCaseKeys(caseKeys, options.runs);
  }

  console.log('View cases in UI: Test Cases → project "Automation Web Demos" → group "Public Site Demos"');
  console.log('Re-probe: npm run automation:stability-probe -- --caseKeys DEMO-EX01,DEMO-INET,DEMO-HTTP,DEMO-WIKI,DEMO-TODO --runs 10\n');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Demo seed failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
