const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTestCaseImportHeaders,
  parseManualStepsFromRow,
  resolveImportWorksheet,
  TEST_CASE_IMPORT_SHEET_NAME,
} = require('../src/utils/testCaseImportTemplate');

const normalizeStepExpected = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

test('buildTestCaseImportHeaders includes manual columns only', () => {
  const headers = buildTestCaseImportHeaders();
  assert.ok(headers.includes('Step 1 Action'));
  assert.ok(headers.includes('Step 1 Expected'));
  assert.ok(headers.includes('Expected Result'));
  assert.equal(headers.includes('Automation Enabled'), false);
  assert.equal(headers.includes('Auto Step 1 Action'), false);
});

test('parseManualStepsFromRow reads action and expected columns', () => {
  const steps = parseManualStepsFromRow(
    {
      'Step 1 Action': 'Open page',
      'Step 1 Expected': 'Page loads',
      'Step 2 Action': 'Click submit',
      'Step 2 Expected': '',
    },
    normalizeStepExpected,
  );

  assert.equal(steps.length, 2);
  assert.equal(steps[0].action, 'Open page');
  assert.equal(steps[0].expected, 'Page loads');
  assert.equal(steps[1].action, 'Click submit');
  assert.equal(steps[1].expected, null);
});

test('resolveImportWorksheet prefers TestCases sheet over guide tab order', () => {
  const workbook = {
    SheetNames: ['Hướng dẫn', TEST_CASE_IMPORT_SHEET_NAME],
    Sheets: {
      'Hướng dẫn': { A1: { v: 'guide' } },
      [TEST_CASE_IMPORT_SHEET_NAME]: { A1: { v: 'data' } },
    },
  };

  const resolved = resolveImportWorksheet(workbook);
  assert.equal(resolved.sheetName, TEST_CASE_IMPORT_SHEET_NAME);
  assert.equal(resolved.sheet.A1.v, 'data');
});

test('resolveImportWorksheet falls back to first sheet for legacy workbooks', () => {
  const workbook = {
    SheetNames: ['OnlySheet'],
    Sheets: {
      OnlySheet: { A1: { v: 'legacy' } },
    },
  };

  const resolved = resolveImportWorksheet(workbook);
  assert.equal(resolved.sheetName, 'OnlySheet');
  assert.equal(resolved.sheet.A1.v, 'legacy');
});

test('parseManualStepsFromRow detects high step indexes', () => {
  const steps = parseManualStepsFromRow(
    {
      'Step 6 Action': 'Extra step',
      'Step 6 Expected': 'Extra ok',
    },
    normalizeStepExpected,
  );

  assert.equal(steps.length, 1);
  assert.equal(steps[0].order, 6);
  assert.equal(steps[0].expected, 'Extra ok');
});
