const TestCase = require('../models/TestCase');

const { assertAllowedBaseUrl } = require('./automationUrlPolicy');

const isAutomationEnabledCase = (testCase) => Boolean(testCase?.automation?.enabled);

const isValidAutomationBaseUrl = (value) => {
  try {
    assertAllowedBaseUrl(value);
    return true;
  } catch {
    return false;
  }
};

const getCaseAutomationBaseUrl = (testCase) => String(testCase?.automation?.baseUrl || '').trim();

const automationCaseNeedsRunBaseUrl = (testCase, runBaseUrl = '') => {
  if (!isAutomationEnabledCase(testCase)) {
    return false;
  }
  if (isValidAutomationBaseUrl(runBaseUrl)) {
    return false;
  }
  return !isValidAutomationBaseUrl(getCaseAutomationBaseUrl(testCase));
};

const loadTestCaseMapForResults = async (results) => {
  const testCaseIds = Array.from(new Set(
    (Array.isArray(results) ? results : [])
      .map((result) => result?.testCase)
      .filter(Boolean)
      .map((value) => String(value)),
  ));

  if (!testCaseIds.length) {
    return new Map();
  }

  const testCases = await TestCase.find({ _id: { $in: testCaseIds } })
    .select('automation.enabled')
    .lean();

  return new Map(testCases.map((testCase) => [String(testCase._id), testCase]));
};

const partitionResultsByAutomation = (results, testCaseMap) => {
  const automationResults = [];
  const manualResults = [];

  for (const result of Array.isArray(results) ? results : []) {
    const testCase = testCaseMap.get(String(result?.testCase));
    if (isAutomationEnabledCase(testCase)) {
      automationResults.push(result);
    } else {
      manualResults.push(result);
    }
  }

  return { automationResults, manualResults };
};

const getAutomationResultIds = (results, testCaseMap) =>
  partitionResultsByAutomation(results, testCaseMap).automationResults.map((result) => String(result._id));

const getPendingAutomationResultIds = (results, testCaseMap) =>
  partitionResultsByAutomation(results, testCaseMap)
    .automationResults
    .filter((result) => !result.executedAt && result.status === 'untested')
    .map((result) => String(result._id));

const runHasAutomationCases = (results, testCaseMap) =>
  partitionResultsByAutomation(results, testCaseMap).automationResults.length > 0;

const isAutomationRunResult = (result, testCaseMap) =>
  isAutomationEnabledCase(testCaseMap.get(String(result?.testCase)));

module.exports = {
  isAutomationEnabledCase,
  isValidAutomationBaseUrl,
  automationCaseNeedsRunBaseUrl,
  loadTestCaseMapForResults,
  partitionResultsByAutomation,
  getAutomationResultIds,
  getPendingAutomationResultIds,
  runHasAutomationCases,
  isAutomationRunResult,
};
