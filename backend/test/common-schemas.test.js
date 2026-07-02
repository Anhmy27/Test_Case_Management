const test = require('node:test');
const assert = require('node:assert/strict');
const { optionalTrimmedString } = require('../src/validators/commonSchemas');

const optionalStringSchema = optionalTrimmedString();

test('optionalTrimmedString treats null as undefined', () => {
  const parsed = optionalStringSchema.parse(null);
  assert.equal(parsed, undefined);
});

test('optionalTrimmedString trims string values', () => {
  const parsed = optionalStringSchema.parse('  hello  ');
  assert.equal(parsed, 'hello');
});

test('optionalTrimmedString coerces numbers and booleans to trimmed strings', () => {
  assert.equal(optionalStringSchema.parse(42), '42');
  assert.equal(optionalStringSchema.parse(true), 'true');
});
