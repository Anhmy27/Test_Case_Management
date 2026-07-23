const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processRecordingEvents,
  buildIntentBlocks,
  applyAutoWaitSuggestions,
  buildDraftSteps,
  buildSemanticActions,
} = require('../src/services/recording/recordingPipeline');

const baseEvent = (overrides = {}) => ({
  eventId: overrides.eventId || `evt-${overrides.sequence ?? 0}`,
  sequence: overrides.sequence ?? 0,
  rawType: overrides.rawType || 'click',
  occurredAt: overrides.occurredAt || new Date('2026-07-21T00:00:00.000Z'),
  pageUrl: overrides.pageUrl || 'http://localhost:3000',
  payload: overrides.payload ?? {},
});

const assertEveryDraftStepGrouped = (result) => {
  const groupedIds = result.intentBlocks.flatMap((block) => block.draftStepIds);
  assert.deepEqual(groupedIds.sort(), result.draftSteps.map((step) => step.draftStepId).sort());
};

test('SR-3.1 groups login flow into navigation and login intent blocks', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/login',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/login',
        payload: { name: 'username', value: 'a' },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/login',
        payload: { name: 'username', value: 'dmin' },
      }),
      baseEvent({
        sequence: 2,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/login',
        payload: { testid: 'login-btn' },
      }),
    ],
  });

  assert.equal(result.intentBlocks.length, 2);
  assert.equal(result.intentBlocks[0].label, 'Chuyển trang http://localhost:3000/login');
  assert.equal(result.intentBlocks[1].label, 'Đăng nhập');
  assert.deepEqual(
    result.intentBlocks[1].draftStepIds,
    [result.draftSteps[1].draftStepId, result.draftSteps[2].draftStepId],
  );
  assertEveryDraftStepGrouped(result);
});

test('SR-3.1 groups search and upload flows', () => {
  const searchResult = processRecordingEvents({
    baseUrl: 'http://localhost:3000/home',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/home',
        payload: { name: 'search', value: 'invoice' },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/home',
        payload: { testid: 'search-btn', text: 'Search' },
      }),
    ],
  });
  assert.equal(searchResult.intentBlocks.at(-1).label, 'Tìm kiếm');
  assert.equal(searchResult.intentBlocks.at(-1).draftStepIds.length, 2);

  const uploadResult = processRecordingEvents({
    baseUrl: 'http://localhost:3000/files',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'file_upload',
        pageUrl: 'http://localhost:3000/files',
        payload: { name: 'attachment', value: 'report.pdf' },
      }),
    ],
  });
  assert.equal(uploadResult.intentBlocks.at(-1).label, 'Upload file');
  assertEveryDraftStepGrouped(uploadResult);
});

test('SR-3.2 suggests waitFor after goto before next interaction', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/login',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/login',
        payload: { name: 'username', value: 'admin' },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/login',
        payload: { testid: 'login-btn' },
      }),
    ],
  });

  const gotoStep = result.draftSteps[0];
  assert.match(gotoStep.autoWaitSuggestion, /waitFor/i);
  assert.match(gotoStep.autoWaitSuggestion, /username|admin|phần tử/i);
});

test('SR-3.2 suggests waitFor after modal trigger click', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/dashboard',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { testid: 'open-user-modal', text: 'Open dialog' },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { name: 'displayName', value: 'Tester' },
      }),
    ],
  });

  assert.match(result.draftSteps[0].autoWaitSuggestion, /popup|dialog|waitFor/i);
  assert.match(result.draftSteps[0].autoWaitSuggestion, /displayName|phần tử/i);
});

test('SR-3.2 suggests waitFor after login submit when next page interaction follows', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/login',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/login',
        payload: { name: 'username', value: 'admin' },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/login',
        payload: { testid: 'login-btn', roleName: 'Đăng nhập' },
      }),
      baseEvent({
        sequence: 2,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { testid: 'menu-settings' },
      }),
    ],
  });

  const loginClickStep = result.draftSteps.find((step) => step.target === 'login-btn');
  assert.ok(loginClickStep);
  assert.match(loginClickStep.autoWaitSuggestion, /waitFor/i);
  assert.match(loginClickStep.autoWaitSuggestion, /menu-settings|dashboard|phần tử/i);
});

test('SR-3.1 + SR-3.2 pipeline leaves non-trigger steps without wait suggestion', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/dashboard',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { testid: 'menu-settings' },
      }),
    ],
  });

  assert.equal(result.intentBlocks.length, 2);
  assert.equal(result.draftSteps.at(-1).autoWaitSuggestion, '');
});

test('SR-3 exported helpers buildIntentBlocks and applyAutoWaitSuggestions stay usable', () => {
  const baseUrl = 'http://localhost:3000/dashboard';
  const events = [
    baseEvent({
      sequence: 0,
      rawType: 'click',
      pageUrl: baseUrl,
      payload: { testid: 'menu-settings' },
    }),
  ];
  const { events: cleanedEvents, semanticActions } = processRecordingEvents({ baseUrl, events });
  const baseDraftSteps = buildDraftSteps(cleanedEvents, semanticActions, baseUrl);
  const draftSteps = applyAutoWaitSuggestions(baseDraftSteps, cleanedEvents, baseUrl);
  const blocks = buildIntentBlocks(draftSteps, cleanedEvents, baseUrl);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, `Chuyển trang ${baseUrl}`);
  assert.equal(draftSteps.at(-1).autoWaitSuggestion, '');
});

test('SR-3.3 flags likely missed click when DOM fingerprint is unchanged after click', () => {
  const sameDom = '<html><body><button id="noop">Details</button></body></html>';
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/settings',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/settings',
        payload: { testid: 'row-details', text: 'Details', domHtml: sameDom },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/settings',
        payload: { testid: 'menu-settings', domHtml: sameDom },
      }),
    ],
  });

  const detailsClick = result.draftSteps.find((step) => step.target === 'row-details');
  assert.ok(detailsClick);
  assert.match(detailsClick.autoWaitSuggestion, /click hụt|không đổi/i);
  assert.ok(result.events[0].payload.domFingerprint);
  assert.equal(result.events[0].payload.domHtml, undefined);
});

test('SR-3.3 suggests waitFor when DOM changes a lot on the same URL (SPA)', () => {
  const beforeDom = '<html><body><div id="list"><span>a</span></div></body></html>';
  const afterDom = `<html><body><div id="detail">${'x'.repeat(400)}<button id="edit">Edit</button></div></body></html>`;
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/items',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/items',
        payload: { testid: 'row-1', text: 'Open row', domHtml: beforeDom },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/items',
        payload: { testid: 'edit-btn', text: 'Edit', domHtml: afterDom },
      }),
    ],
  });

  const openRow = result.draftSteps.find((step) => step.target === 'row-1');
  assert.ok(openRow);
  assert.match(openRow.autoWaitSuggestion, /SPA|DOM đổi mạnh|waitFor/i);
  assert.match(openRow.autoWaitSuggestion, /edit-btn|phần tử/i);
});

test('SR-3.3 skips input without fingerprint and compares next DOM-bearing event', () => {
  const beforeDom = '<html><body><button id="open">Open</button></body></html>';
  const afterDom = `<html><body><div id="panel">${'z'.repeat(400)}<input name="title"/></div></body></html>`;
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/items',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/items',
        payload: { testid: 'open-panel', text: 'Open', domHtml: beforeDom },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/items',
        payload: { name: 'title', value: 'x' }, // no DOM — BL-2 skips visuals on input
      }),
      baseEvent({
        sequence: 2,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/items',
        payload: { testid: 'save-btn', text: 'Save', domHtml: afterDom },
      }),
    ],
  });

  const openPanel = result.draftSteps.find((step) => step.target === 'open-panel');
  assert.ok(openPanel);
  assert.match(openPanel.autoWaitSuggestion, /SPA|DOM đổi mạnh|waitFor/i);
});

test('SR-3.3 does not override stronger SR-3.2 modal wait suggestion', () => {
  const beforeDom = '<html><body><button>Open</button></body></html>';
  const afterDom = `<html><body><div role="dialog">${'y'.repeat(400)}<input name="displayName"/></div></body></html>`;
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/dashboard',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { testid: 'open-user-modal', text: 'Open dialog', domHtml: beforeDom },
      }),
      baseEvent({
        sequence: 1,
        rawType: 'input',
        pageUrl: 'http://localhost:3000/dashboard',
        payload: { name: 'displayName', value: 'Tester', domHtml: afterDom },
      }),
    ],
  });

  assert.match(result.draftSteps[0].autoWaitSuggestion, /popup|dialog|waitFor/i);
  assert.doesNotMatch(result.draftSteps[0].autoWaitSuggestion, /click hụt|SPA/i);
});
