const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  createTestCaseService,
  listTestCasesService,
  listTestCaseDetailsService,
  importTestCasesService,
  getTestCaseService,
  getTestCaseVersionsService,
  updateTestCaseService,
  deleteTestCaseService,
  restoreTestCaseService,
} = require('../services/testCaseServices');

const createTestCase = asyncHandler(async (req, res) => {
  const testCase = await createTestCaseService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'test_case.create',
    resourceType: 'test_case',
    ...pickEntityAuditFields(testCase, { labelKeys: ['caseKey', 'title', 'name'] }),
    projectId: String(req.body?.projectId || testCase?.project || ''),
  });
  res.status(201).json({ testCase });
});

const listTestCases = asyncHandler(async (req, res) => {
  const result = await listTestCasesService(req.query || {});
  res.json(result);
});

const listTestCaseDetails = asyncHandler(async (req, res) => {
  const result = await listTestCaseDetailsService(req.query || {});
  res.json(result);
});

const importTestCases = asyncHandler(async (req, res) => {
  const result = await importTestCasesService({
    file: req.file,
    body: req.body || {},
    userId: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'test_case.import',
    resourceType: 'test_case',
    projectId: String(req.body?.projectId || ''),
    metadata: {
      importedCount: result?.importedCount,
      skippedCount: result?.skippedCount,
      fileName: req.file?.originalname || '',
    },
  });
  res.json(result);
});

const getTestCase = asyncHandler(async (req, res) => {
  const testCase = await getTestCaseService(req.params.testCaseId);
  res.json({ testCase: testCase || null });
});

const getTestCaseVersions = asyncHandler(async (req, res) => {
  const versions = await getTestCaseVersionsService(req.params.testCaseId);
  res.json({ versions });
});

const updateTestCase = asyncHandler(async (req, res) => {
  const testCase = await updateTestCaseService(req.params.testCaseId, req.body || {});
  await auditFromRequest(req, {
    action: 'test_case.update',
    resourceType: 'test_case',
    ...pickEntityAuditFields(testCase, { labelKeys: ['caseKey', 'title', 'name'] }),
  });
  res.json({ testCase });
});

const deleteTestCase = asyncHandler(async (req, res) => {
  await deleteTestCaseService(req.params.testCaseId);
  await auditFromRequest(req, {
    action: 'test_case.delete',
    resourceType: 'test_case',
    resourceId: req.params.testCaseId,
  });
  res.status(204).send();
});

const restoreTestCase = asyncHandler(async (req, res) => {
  const testCase = await restoreTestCaseService(req.params.testCaseId);
  await auditFromRequest(req, {
    action: 'test_case.restore',
    resourceType: 'test_case',
    ...pickEntityAuditFields(testCase, { labelKeys: ['caseKey', 'title', 'name'] }),
  });
  res.json({ testCase });
});

module.exports = {
  createTestCase,
  listTestCases,
  listTestCaseDetails,
  importTestCases,
  getTestCase,
  getTestCaseVersions,
  updateTestCase,
  deleteTestCase,
  restoreTestCase,
};
