/**
 * Phase 0 — Measure automation flakiness by running dry-run N times per test case.
 *
 * Usage (from backend/):
 *   npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10
 *   npm run automation:stability-probe -- --caseKeys AUTH3,SDF --runs 10 --baseUrl https://app.example.com
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const TestCase = require('../src/models/TestCase');
const { connectDatabase } = require('../src/config/db');
const { dryRunAutomationService } = require('../src/services/automation/dryRunService');

const PROBE_USER = {
  id: 'stability-probe',
  name: 'Stability Probe',
  email: 'probe@local',
  role: 'admin',
};

const parseArgs = (argv) => {
  const options = {
    caseKeys: [],
    runs: 10,
    baseUrl: '',
  };

  const isFlag = (token) => typeof token === 'string' && token.startsWith('--');

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--caseKeys') {
      index += 1;
      if (index < argv.length && !isFlag(argv[index])) {
        while (index < argv.length && !isFlag(argv[index])) {
          const chunk = String(argv[index])
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
          options.caseKeys.push(...chunk);
          index += 1;
        }
        index -= 1;
      }
      continue;
    }

    if (token === '--runs' && argv[index + 1]) {
      options.runs = Math.max(1, Number(argv[index + 1]) || 10);
      index += 1;
      continue;
    }

    if (token === '--baseUrl' && argv[index + 1]) {
      options.baseUrl = String(argv[index + 1]).trim();
      index += 1;
    }
  }

  options.caseKeys = [...new Set(options.caseKeys)];
  return options;
};

const findLatestCaseByKey = async (caseKey) => {
  const normalizedKey = String(caseKey || '').trim();
  if (!normalizedKey) {
    return null;
  }

  return TestCase.findOne({
    caseKey: normalizedKey,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
};

const extractFailedStepHint = (note) => {
  const text = String(note || '');
  const stepMatch = text.match(/Step #(\d+)/i);
  if (stepMatch) {
    return `step #${stepMatch[1]}`;
  }
  const actionMatch = text.match(/Action:\s*(\w+)/i);
  if (actionMatch) {
    return actionMatch[1];
  }
  const firstLine = text.split('\n').find((line) => line.trim());
  return firstLine ? firstLine.slice(0, 120) : '';
};

const runProbeForCase = async ({ testCase, runs, baseUrlOverride }) => {
  const automation = testCase.automation || {};
  const caseKey = testCase.caseKey || '';
  const testCaseId = String(testCase.entityId || testCase._id || '');

  if (!automation.enabled) {
    return {
      caseKey,
      testCaseId,
      title: testCase.title || '',
      skipped: true,
      skipReason: 'automation.enabled is false',
      runs: [],
      summary: null,
    };
  }

  if (!Array.isArray(automation.steps) || automation.steps.length === 0) {
    return {
      caseKey,
      testCaseId,
      title: testCase.title || '',
      skipped: true,
      skipReason: 'no automation steps',
      runs: [],
      summary: null,
    };
  }

  const runResults = [];

  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    const startedAt = Date.now();
    process.stdout.write(`  Run ${String(runIndex).padStart(2, ' ')}/${runs} ... `);

    try {
      const result = await dryRunAutomationService({
        testCaseId,
        automation,
        baseUrl: baseUrlOverride,
        user: PROBE_USER,
      });

      const status = String(result.status || 'fail').toLowerCase();
      const durationMs = Date.now() - startedAt;
      const failedHint = status === 'pass' ? '' : extractFailedStepHint(result.note);

      runResults.push({
        runIndex,
        status,
        durationMs,
        failedHint,
        dryRunId: result.dryRunId || '',
      });

      const label = status.toUpperCase().padEnd(4);
      const hint = failedHint ? ` (${failedHint})` : '';
      console.log(`${label} ${(durationMs / 1000).toFixed(1)}s${hint}`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error?.message || 'Unknown error';
      runResults.push({
        runIndex,
        status: 'error',
        durationMs,
        failedHint: message.slice(0, 200),
        dryRunId: '',
      });
      console.log(`ERR  ${(durationMs / 1000).toFixed(1)}s (${message.slice(0, 80)})`);
    }
  }

  const passCount = runResults.filter((item) => item.status === 'pass').length;
  const failCount = runResults.filter((item) => item.status !== 'pass').length;
  const statuses = new Set(runResults.map((item) => item.status));
  const consistent = statuses.size === 1;
  const passRatePct = runs > 0 ? Math.round((passCount / runs) * 100) : 0;

  let verdict = 'STABLE';
  if (!consistent) {
    verdict = 'FLAKY (mixed results)';
  } else if (passCount === 0) {
    verdict = 'STABLE_FAIL (always fails — fix steps or app)';
  } else if (passCount === runs) {
    verdict = 'STABLE_PASS';
  }

  return {
    caseKey,
    testCaseId,
    title: testCase.title || '',
    skipped: false,
    runs: runResults,
    summary: {
      totalRuns: runs,
      passCount,
      failCount,
      passRatePct,
      consistent,
      verdict,
    },
  };
};

const printCaseSummary = (report) => {
  if (report.skipped) {
    console.log(`\n[SKIP] ${report.caseKey}: ${report.skipReason}`);
    return;
  }

  const { summary } = report;
  console.log(`\n--- ${report.caseKey} — ${report.title} ---`);
  console.log(`Pass rate: ${summary.passCount}/${summary.totalRuns} (${summary.passRatePct}%)`);
  console.log(`Consistent: ${summary.consistent ? 'YES' : 'NO'}`);
  console.log(`Verdict: ${summary.verdict}`);

  const nonPass = report.runs.filter((item) => item.status !== 'pass');
  if (nonPass.length > 0 && nonPass.length < report.runs.length) {
    const hints = [...new Set(nonPass.map((item) => item.failedHint).filter(Boolean))];
    if (hints.length) {
      console.log(`Failure hints: ${hints.join(' | ')}`);
    }
  }
};

const writeReportFile = (payload) => {
  const reportsDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `automation-stability-${timestamp}.json`;
  const filePath = path.join(reportsDir, fileName);

  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!options.caseKeys.length) {
    console.error('Usage: npm run automation:stability-probe -- --caseKeys KEY1,KEY2 --runs 10 [--baseUrl URL]');
    process.exit(1);
  }

  await connectDatabase();

  console.log('\nAutomation Stability Probe (Phase 0)');
  console.log(`Cases: ${options.caseKeys.join(', ')}`);
  console.log(`Runs per case: ${options.runs}`);
  if (options.baseUrl) {
    console.log(`Base URL override: ${options.baseUrl}`);
  }
  console.log('');

  const caseReports = [];

  for (const caseKey of options.caseKeys) {
    const testCase = await findLatestCaseByKey(caseKey);
    if (!testCase) {
      console.error(`\n[ERROR] Test case not found: ${caseKey}`);
      caseReports.push({
        caseKey,
        skipped: true,
        skipReason: 'test case not found in DB',
        runs: [],
        summary: null,
      });
      continue;
    }

    console.log(`\nProbing: ${caseKey} (${testCase.title || 'no title'})`);
    const report = await runProbeForCase({
      testCase,
      runs: options.runs,
      baseUrlOverride: options.baseUrl,
    });
    caseReports.push(report);
    printCaseSummary(report);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    phase: 'P0-baseline',
    options,
    cases: caseReports,
  };

  const reportPath = writeReportFile(payload);

  console.log('\n========================================');
  console.log(`Report saved: ${reportPath}`);
  console.log('Copy results into AUTOMATION_STABILITY_ROADMAP.md → Kết quả baseline');
  console.log('When ready, confirm to proceed to Phase 1.');
  console.log('========================================\n');

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Probe failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
