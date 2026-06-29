const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatRunNameTimestamp, RUN_NAME_TIME_ZONE } = require('../src/utils/runNameTimestamp');

test('formatRunNameTimestamp uses Asia/Ho_Chi_Minh timezone', () => {
  assert.equal(RUN_NAME_TIME_ZONE, 'Asia/Ho_Chi_Minh');
  const formatted = formatRunNameTimestamp(new Date('2026-06-29T06:50:00.000Z'));
  assert.equal(formatted, '2026-06-29 13:50');
});

test('formatRunNameTimestamp keeps YYYY-MM-DD HH:mm shape', () => {
  const formatted = formatRunNameTimestamp(new Date('2026-01-01T17:05:00.000Z'));
  assert.match(formatted, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(formatted, '2026-01-02 00:05');
});
