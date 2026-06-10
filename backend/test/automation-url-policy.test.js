const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  assertAllowedBaseUrl,
  resolveNavigationUrl,
  resolveSandboxedUploadPaths,
} = require('../src/utils/automationUrlPolicy');

test('assertAllowedBaseUrl rejects metadata host', () => {
  assert.throws(
    () => assertAllowedBaseUrl('http://169.254.169.254/latest/meta-data'),
    /not allowed/,
  );
});

test('resolveNavigationUrl allows same-origin relative navigation', () => {
  const resolved = resolveNavigationUrl('https://rd.cytech.ai/app', '/login');
  assert.equal(resolved, 'https://rd.cytech.ai/login');
});

test('resolveNavigationUrl blocks off-origin absolute navigation', () => {
  assert.throws(
    () => resolveNavigationUrl('https://rd.cytech.ai/app', 'https://evil.example.com/path'),
    /not allowed/,
  );
});

test('resolveNavigationUrl honors AUTOMATION_ALLOWED_HOSTS', () => {
  const previous = process.env.AUTOMATION_ALLOWED_HOSTS;
  process.env.AUTOMATION_ALLOWED_HOSTS = 'evil.example.com';

  try {
    const resolved = resolveNavigationUrl(
      'https://rd.cytech.ai/app',
      'https://evil.example.com/path',
    );
    assert.equal(resolved, 'https://evil.example.com/path');
  } finally {
    if (previous === undefined) {
      delete process.env.AUTOMATION_ALLOWED_HOSTS;
    } else {
      process.env.AUTOMATION_ALLOWED_HOSTS = previous;
    }
  }
});

test('resolveSandboxedUploadPaths rejects paths outside upload root', () => {
  const previous = process.env.AUTOMATION_UPLOAD_DIR;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-upload-'));
  process.env.AUTOMATION_UPLOAD_DIR = tempRoot;

  delete require.cache[require.resolve('../src/config/automationArtifacts')];
  delete require.cache[require.resolve('../src/utils/automationUrlPolicy')];
  const { resolveSandboxedUploadPaths: resolveFresh } = require('../src/utils/automationUrlPolicy');

  try {
    assert.throws(
      () => resolveFresh('../../../package.json'),
      /must stay under/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (previous === undefined) {
      delete process.env.AUTOMATION_UPLOAD_DIR;
    } else {
      process.env.AUTOMATION_UPLOAD_DIR = previous;
    }
    delete require.cache[require.resolve('../src/config/automationArtifacts')];
    delete require.cache[require.resolve('../src/utils/automationUrlPolicy')];
  }
});
