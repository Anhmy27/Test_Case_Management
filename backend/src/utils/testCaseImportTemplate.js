const MANUAL_STEP_COLUMNS = 5;
const TEST_CASE_IMPORT_SHEET_NAME = 'TestCases';

const PRIORITY_VALUES = ['lowest', 'low', 'medium', 'high', 'highest'];
const SEVERITY_VALUES = ['minor', 'major', 'critical'];
const TYPE_VALUES = ['functional', 'api', 'ui', 'regression', 'security', 'other'];

const buildManualStepHeaders = (count = MANUAL_STEP_COLUMNS) => {
  const headers = [];
  for (let index = 1; index <= count; index += 1) {
    headers.push(`Step ${index} Action`, `Step ${index} Expected`);
  }
  return headers;
};

const buildTestCaseImportHeaders = ({ manualStepCount = MANUAL_STEP_COLUMNS } = {}) => [
  'Group Key',
  'Group Name',
  'Case Key',
  'Title',
  'Priority',
  'Severity',
  'Type',
  'Description',
  ...buildManualStepHeaders(manualStepCount),
  'Expected Result',
];

const parseManualStepsFromRow = (row, normalizeStepExpected) => {
  const stepPattern = /^Step\s*(\d+)\s*Action$/i;
  const detectedSteps = Object.keys(row)
    .map((columnKey) => {
      const match = String(columnKey).match(stepPattern);
      if (!match) {
        return null;
      }
      return { key: columnKey, idx: parseInt(match[1], 10) };
    })
    .filter(Boolean)
    .sort((left, right) => left.idx - right.idx);

  const stepExpectedPattern = /^Step\s*(\d+)\s*Expected$/i;
  const stepExpectedByIndex = Object.keys(row).reduce((acc, columnKey) => {
    const match = String(columnKey).match(stepExpectedPattern);
    if (!match) {
      return acc;
    }
    acc[parseInt(match[1], 10)] = normalizeStepExpected(row[columnKey]);
    return acc;
  }, {});

  const steps = [];
  for (const detected of detectedSteps) {
    const action = String(row[detected.key] || '').trim();
    if (action) {
      steps.push({
        order: detected.idx,
        action,
        expected: stepExpectedByIndex[detected.idx] ?? null,
      });
    }
  }

  return steps;
};

const resolveImportWorksheet = (workbook) => {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    return { sheet: null, sheetName: null };
  }

  const preferredSheet = workbook.Sheets[TEST_CASE_IMPORT_SHEET_NAME];
  if (preferredSheet) {
    return { sheet: preferredSheet, sheetName: TEST_CASE_IMPORT_SHEET_NAME };
  }

  const fallbackName = workbook.SheetNames[0];
  return {
    sheet: workbook.Sheets[fallbackName] || null,
    sheetName: fallbackName,
  };
};

module.exports = {
  MANUAL_STEP_COLUMNS,
  TEST_CASE_IMPORT_SHEET_NAME,
  PRIORITY_VALUES,
  SEVERITY_VALUES,
  TYPE_VALUES,
  buildTestCaseImportHeaders,
  parseManualStepsFromRow,
  resolveImportWorksheet,
};
