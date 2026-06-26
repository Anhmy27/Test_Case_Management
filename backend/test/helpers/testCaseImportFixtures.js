const XLSX = require('xlsx');
const {
  TEST_CASE_IMPORT_SHEET_NAME,
  buildTestCaseImportHeaders,
} = require('../../src/utils/testCaseImportTemplate');

const DEFAULT_IMPORT_ROW = {
  'Group Key': 'CORE',
  'Group Name': '',
  'Case Key': 'IMPORT-001',
  Title: 'Imported via Excel',
  Priority: 'medium',
  Severity: 'major',
  Type: 'functional',
  Description: 'Row created from integration fixture',
  'Step 1 Action': 'Open page',
  'Step 1 Expected': 'Page loads',
  'Step 2 Action': '',
  'Step 2 Expected': '',
  'Step 3 Action': '',
  'Step 3 Expected': '',
  'Step 4 Action': '',
  'Step 4 Expected': '',
  'Step 5 Action': '',
  'Step 5 Expected': '',
  'Expected Result': 'Page is visible',
};

function buildImportWorkbookBuffer(rows, { includeGuideSheet = true, sheetOrder = 'data-first' } = {}) {
  const headers = buildTestCaseImportHeaders();
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const guideSheet = XLSX.utils.aoa_to_sheet([['Hướng dẫn']]);

  if (sheetOrder === 'guide-first') {
    if (includeGuideSheet) {
      XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn');
    }
    XLSX.utils.book_append_sheet(workbook, dataSheet, TEST_CASE_IMPORT_SHEET_NAME);
  } else {
    XLSX.utils.book_append_sheet(workbook, dataSheet, TEST_CASE_IMPORT_SHEET_NAME);
    if (includeGuideSheet) {
      XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn');
    }
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildDefaultImportBuffer(overrides = {}, options = {}) {
  return buildImportWorkbookBuffer(
    [{ ...DEFAULT_IMPORT_ROW, ...overrides }],
    options,
  );
}

module.exports = {
  DEFAULT_IMPORT_ROW,
  buildImportWorkbookBuffer,
  buildDefaultImportBuffer,
};
