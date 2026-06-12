const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocalArtifactStorage } = require('../src/services/automation/artifactStorage/localArtifactStorage');
const { resetArtifactStorageForTests } = require('../src/services/automation/artifactStorage');

test('local artifact storage saves and reads by logical key', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-artifacts-'));
  const storage = createLocalArtifactStorage({ rootDir });
  const key = storage.buildRunFailureScreenshotKey('runA', 'resultB', 'png');

  storage.saveBuffer(key, Buffer.from('fake-image'));
  assert.equal(storage.exists(key), true);

  const absolutePath = storage.resolveReadablePath(key);
  assert.ok(absolutePath);
  assert.equal(fs.readFileSync(absolutePath, 'utf8'), 'fake-image');

  resetArtifactStorageForTests();
  fs.rmSync(rootDir, { recursive: true, force: true });
});
