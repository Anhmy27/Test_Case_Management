const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRunFailureScreenshotKey,
  buildDryRunFailureScreenshotKey,
  normalizeStoredArtifactKey,
  extensionFromMime,
} = require('../src/services/automation/artifactKeys');

test('buildRunFailureScreenshotKey uses stable logical key', () => {
  assert.equal(
    buildRunFailureScreenshotKey('run1', 'result1'),
    'runs/run1/result1/failure.png',
  );
  assert.equal(
    buildRunFailureScreenshotKey('run1', 'result1', 'webp'),
    'runs/run1/result1/failure.webp',
  );
});

test('buildDryRunFailureScreenshotKey uses dry-run namespace', () => {
  assert.equal(
    buildDryRunFailureScreenshotKey('abc'),
    'dry-run/abc/failure.png',
  );
});

test('normalizeStoredArtifactKey migrates legacy relative paths', () => {
  assert.equal(
    normalizeStoredArtifactKey('uploads/runs/run1/result1/failure.png'),
    'runs/run1/result1/failure.png',
  );
  assert.equal(
    normalizeStoredArtifactKey('runs/run1/result1/failure.jpg'),
    'runs/run1/result1/failure.jpg',
  );
});

test('extensionFromMime maps upload content types', () => {
  assert.equal(extensionFromMime('image/jpeg'), 'jpg');
  assert.equal(extensionFromMime('image/webp'), 'webp');
});
