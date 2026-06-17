const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/auditLogService.js');
const modelPath = path.resolve(__dirname, '../src/models/AuditLog.js');

function setMock(modulePath, exportsValue) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

test('recordAuditLog trims labels and stores actor fields', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  let captured = null;
  setMock(modelPath, {
    create: async (payload) => {
      captured = payload;
      return payload;
    },
  });

  const { recordAuditLog } = require(servicePath);
  await recordAuditLog({
    action: 'project.create',
    resourceType: 'project',
    resourceId: 'abc123',
    resourceLabel: '  Demo Project  ',
    projectId: 'abc123',
    userId: 'user1',
    userName: 'Admin',
    userEmail: 'Admin@Example.com',
    userRole: 'admin',
    clientIp: '127.0.0.1',
    metadata: { code: 'DEMO' },
  });

  assert.equal(captured.action, 'project.create');
  assert.equal(captured.resourceLabel, 'Demo Project');
  assert.equal(captured.userEmail, 'admin@example.com');

  require.cache[modelPath] = originalModel;
  delete require.cache[servicePath];
});

test('listAuditLogsService returns paginated logs', async () => {
  const originalModel = require.cache[modelPath];
  delete require.cache[servicePath];

  setMock(modelPath, {
    countDocuments: async () => 120,
    find: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [{ action: 'auth.login', resourceType: 'user' }],
          }),
        }),
      }),
    }),
  });

  const { listAuditLogsService } = require(servicePath);
  const result = await listAuditLogsService({ page: 2, limit: 50, search: 'login' });

  assert.equal(result.logs.length, 1);
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.total, 120);
  assert.equal(result.pagination.pages, 3);

  require.cache[modelPath] = originalModel;
  delete require.cache[servicePath];
});
