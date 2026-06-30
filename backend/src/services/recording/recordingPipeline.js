const crypto = require('crypto');

const DOUBLE_CLICK_WINDOW_MS = 500;
const TYPING_MERGE_TYPES = new Set(['input', 'keypress', 'change']);

const toString = (value) => String(value ?? '').trim();

const toDate = (value) => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '') || parsed.origin;
  } catch {
    return String(value || '').trim().replace(/\/$/, '');
  }
};

const getElementKey = (payload = {}) => {
  const parts = [
    payload.testid,
    payload.id,
    payload.name,
    payload.placeholder,
    payload.label,
    payload.selector,
    payload.tagName,
    payload.text,
  ]
    .map((part) => toString(part).toLowerCase())
    .filter(Boolean);
  return parts.join('|');
};

const getClickKey = (event) => `${event.rawType}:${getElementKey(event.payload)}:${normalizeUrl(event.pageUrl)}`;

const getFieldKey = (event) => `${getElementKey(event.payload)}:${normalizeUrl(event.pageUrl)}`;

const readPayloadValue = (payload = {}) => {
  if (payload == null) return '';
  if (typeof payload.value === 'string' || typeof payload.value === 'number') {
    return String(payload.value);
  }
  if (typeof payload.text === 'string') return payload.text;
  return '';
};

const slugToken = (value, fallback = 'TARGET') => {
  const slug = toString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || fallback;
};

const filterNoise = (events) => {
  const kept = [];
  let lastClickKey = '';
  let lastClickAt = 0;

  for (const event of events) {
    if (event.payload?.noise === true || event.payload?.ignored === true) {
      continue;
    }

    if (event.rawType === 'click') {
      const clickKey = getClickKey(event);
      const occurredAt = toDate(event.occurredAt).getTime();
      if (clickKey === lastClickKey && occurredAt - lastClickAt <= DOUBLE_CLICK_WINDOW_MS) {
        continue;
      }
      lastClickKey = clickKey;
      lastClickAt = occurredAt;
    }

    kept.push(event);
  }

  return kept;
};

const flushTypingBuffer = (buffer, output) => {
  if (!buffer.length) return;

  const first = buffer[0];
  const mergedValue = buffer.map((item) => readPayloadValue(item.payload)).join('');
  output.push({
    ...first,
    rawType: 'input',
    payload: {
      ...(first.payload || {}),
      value: mergedValue,
    },
  });
};

const mergeTypingEvents = (events) => {
  const merged = [];
  let typingBuffer = [];
  let typingFieldKey = '';

  const flush = () => {
    flushTypingBuffer(typingBuffer, merged);
    typingBuffer = [];
    typingFieldKey = '';
  };

  for (const event of events) {
    if (!TYPING_MERGE_TYPES.has(event.rawType)) {
      flush();
      merged.push(event);
      continue;
    }

    const fieldKey = getFieldKey(event);
    const chunk = readPayloadValue(event.payload);

    if (event.rawType === 'change' && chunk.length > 1) {
      flush();
      merged.push(event);
      continue;
    }

    if (!typingBuffer.length || fieldKey === typingFieldKey) {
      typingBuffer.push(event);
      typingFieldKey = fieldKey;
      continue;
    }

    flush();
    typingBuffer.push(event);
    typingFieldKey = fieldKey;
  }

  flush();
  return merged;
};

const buildSemanticAction = (event) => {
  const payload = event.payload || {};
  const elementLabel = toString(
    payload.testid || payload.label || payload.placeholder || payload.name || payload.text || payload.id,
  );

  switch (event.rawType) {
    case 'navigation':
      return {
        semanticId: 'NAVIGATE',
        label: `Chuyển trang ${toString(event.pageUrl) || 'mới'}`,
        sourceEventIds: [event.eventId],
      };
    case 'input':
      return {
        semanticId: `FILL_${slugToken(elementLabel, 'FIELD')}`,
        label: `Điền ${elementLabel || 'ô nhập'} = ${readPayloadValue(payload)}`,
        sourceEventIds: [event.eventId],
      };
    case 'select_change':
      return {
        semanticId: `SELECT_${slugToken(elementLabel, 'FIELD')}`,
        label: `Chọn ${elementLabel || 'dropdown'} = ${readPayloadValue(payload)}`,
        sourceEventIds: [event.eventId],
      };
    case 'file_upload':
      return {
        semanticId: 'UPLOAD_FILE',
        label: `Upload file ${readPayloadValue(payload) || ''}`.trim(),
        sourceEventIds: [event.eventId],
      };
    case 'submit':
      return {
        semanticId: 'SUBMIT_FORM',
        label: 'Gửi form',
        sourceEventIds: [event.eventId],
      };
    case 'click':
    default:
      return {
        semanticId: `CLICK_${slugToken(elementLabel, 'TARGET')}`,
        label: `Click ${elementLabel || 'phần tử'}`,
        sourceEventIds: [event.eventId],
      };
  }
};

const inferTargetFromPayload = (payload = {}) => {
  if (toString(payload.testid)) {
    return { targetType: 'testid', target: toString(payload.testid) };
  }
  if (toString(payload.id)) {
    return { targetType: 'id', target: toString(payload.id) };
  }
  if (toString(payload.placeholder)) {
    return { targetType: 'placeholder', target: toString(payload.placeholder) };
  }
  if (toString(payload.label)) {
    return { targetType: 'label', target: toString(payload.label) };
  }
  if (toString(payload.text)) {
    return { targetType: 'text', target: toString(payload.text) };
  }
  if (toString(payload.selector)) {
    return { targetType: 'css', target: toString(payload.selector) };
  }
  return { targetType: 'css', target: '' };
};

const buildDraftStepFromEvent = (event, order, semanticAction) => ({
  draftStepId: crypto.randomUUID(),
  order,
  inferredAction: mapEventToAction(event.rawType),
  ...inferTargetFromPayload(event.payload),
  value: readStepValue(event),
  expected: '',
  locatorCandidates: [],
  chosenLocatorIndex: 0,
  reviewStatus: 'pending',
  screenshotKey: '',
  autoWaitSuggestion: '',
  sourceSemanticId: semanticAction.semanticId,
});

const mapEventToAction = (rawType) => {
  switch (rawType) {
    case 'navigation':
      return 'goto';
    case 'input':
    case 'keypress':
      return 'type';
    case 'select_change':
      return 'select';
    case 'file_upload':
      return 'upload';
    case 'click':
    case 'submit':
    default:
      return 'click';
  }
};

const readStepValue = (event) => {
  if (event.rawType === 'navigation') {
    return toString(event.pageUrl);
  }
  return readPayloadValue(event.payload);
};

const shouldPrependBaseGoto = (events, baseUrl) => {
  if (!toString(baseUrl)) return false;
  const first = events[0];
  if (!first) return true;
  if (first.rawType === 'navigation') {
    return normalizeUrl(first.pageUrl) !== normalizeUrl(baseUrl);
  }
  return true;
};

const buildDraftSteps = (events, semanticActions, baseUrl) => {
  const draftSteps = [];
  let order = 1;

  if (shouldPrependBaseGoto(events, baseUrl)) {
    draftSteps.push({
      draftStepId: crypto.randomUUID(),
      order,
      inferredAction: 'goto',
      targetType: 'url',
      target: toString(baseUrl),
      value: toString(baseUrl),
      expected: '',
      locatorCandidates: [],
      chosenLocatorIndex: 0,
      reviewStatus: 'pending',
      screenshotKey: '',
      autoWaitSuggestion: '',
      sourceSemanticId: 'OPEN_BASE_URL',
    });
    order += 1;
  }

  events.forEach((event, index) => {
    draftSteps.push(buildDraftStepFromEvent(event, order, semanticActions[index]));
    order += 1;
  });

  return draftSteps;
};

const buildSemanticActions = (events) => events.map((event) => buildSemanticAction(event));

/**
 * SR-1 pipeline: raw events → cleaned events → semantic → draft steps.
 * @param {{ events: object[], baseUrl?: string }} input
 */
const processRecordingEvents = ({ events = [], baseUrl = '' } = {}) => {
  const normalizedEvents = (Array.isArray(events) ? events : []).map((event, index) => ({
    eventId: toString(event.eventId) || crypto.randomUUID(),
    sequence: Number.isInteger(event.sequence) ? event.sequence : index,
    rawType: event.rawType,
    occurredAt: toDate(event.occurredAt),
    pageUrl: toString(event.pageUrl),
    payload: event.payload ?? null,
  }));

  const cleanedEvents = mergeTypingEvents(filterNoise(normalizedEvents));
  const semanticActions = buildSemanticActions(cleanedEvents);
  const draftSteps = buildDraftSteps(cleanedEvents, semanticActions, baseUrl);

  return {
    events: cleanedEvents,
    semanticActions,
    draftSteps,
  };
};

module.exports = {
  processRecordingEvents,
  filterNoise,
  mergeTypingEvents,
  buildSemanticActions,
  buildDraftSteps,
};
