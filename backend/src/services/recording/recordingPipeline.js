const crypto = require('crypto');
const { buildLocatorCandidates, applyChosenLocatorToStepFields } = require('./locatorScoring');

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

const readScreenshotKey = (payload = {}) => toString(payload.screenshotKey);

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

const buildDraftStepFromEvent = (event, order, semanticAction) => {
  const inferredAction = mapEventToAction(event.rawType);
  const locatorCandidates = buildLocatorCandidates(event.payload);
  const {
    targetType,
    target,
    value,
    chosenLocatorIndex,
  } = applyChosenLocatorToStepFields({
    inferredAction,
    value: readStepValue(event),
    locatorCandidates,
    chosenLocatorIndex: 0,
  });

  return {
    draftStepId: crypto.randomUUID(),
    order,
    inferredAction,
    targetType,
    target,
    value,
    expected: '',
    locatorCandidates,
    chosenLocatorIndex,
    reviewStatus: 'pending',
    screenshotKey: readScreenshotKey(event.payload),
    autoWaitSuggestion: '',
    sourceSemanticId: semanticAction.semanticId,
  };
};

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

const stepHaystack = (step) =>
  `${step.target} ${step.value} ${step.sourceSemanticId} ${step.inferredAction}`.toLowerCase();

const isNavigationStep = (step) =>
  step.inferredAction === 'goto'
  || step.sourceSemanticId === 'OPEN_BASE_URL'
  || step.sourceSemanticId === 'NAVIGATE';

const isUploadStep = (step) =>
  step.inferredAction === 'upload' || step.sourceSemanticId === 'UPLOAD_FILE';

const isLoginPageUrl = (pageUrl) => /\/(login|signin|sign-in|auth)(\/|$)/i.test(pageUrl);

const isLoginSubmitStep = (step) => {
  if (step.sourceSemanticId === 'SUBMIT_FORM') return true;
  if (step.inferredAction !== 'click') return false;
  const haystack = stepHaystack(step);
  return /login|signin|sign.in|dang.nhap|submit|dang_nhap|login.btn|login-btn/.test(haystack);
};

const isCredentialFieldStep = (step) => {
  if (step.inferredAction !== 'type' && step.inferredAction !== 'select') return false;
  const haystack = stepHaystack(step);
  return /user|email|pass|pwd|mat.khau|username|credential|login/.test(haystack);
};

const isSearchFieldStep = (step) => {
  if (step.inferredAction !== 'type') return false;
  const haystack = stepHaystack(step);
  return /search|query|keyword|tim.kiem|tim_kiem/.test(haystack)
    || step.sourceSemanticId.includes('SEARCH');
};

const alignDraftStepsWithContext = (draftSteps, cleanedEvents, baseUrl) => {
  let eventIndex = 0;
  return draftSteps.map((step) => {
    if (step.sourceSemanticId === 'OPEN_BASE_URL') {
      return { step, pageUrl: normalizeUrl(step.value || baseUrl), event: null };
    }
    const event = cleanedEvents[eventIndex];
    eventIndex += 1;
    return {
      step,
      pageUrl: normalizeUrl(event?.pageUrl || ''),
      event: event || null,
    };
  });
};

const describeStepTarget = (step) => {
  if (!step) return 'phần tử tiếp theo';
  if (step.inferredAction === 'goto') {
    return `trang ${step.value || step.target || 'đích'}`;
  }
  if (step.targetType === 'testid' && step.target) {
    return `phần tử data-testid="${step.target}"`;
  }
  if (step.targetType === 'role' && step.target) {
    return `phần tử role=${step.target}${step.value ? ` tên "${step.value}"` : ''}`;
  }
  if (step.targetType === 'id' && step.target) {
    return `phần tử #${step.target}`;
  }
  if (step.targetType === 'label' && step.target) {
    return `ô label "${step.target}"`;
  }
  if (step.targetType === 'text' && step.target) {
    return `text "${step.target}"`;
  }
  if (step.target) return `phần tử ${step.target}`;
  return 'phần tử tiếp theo';
};

const isModalTriggerClick = (step, payload = {}) => {
  if (step.inferredAction !== 'click') return false;
  const payloadText = [
    payload.testid,
    payload.text,
    payload.roleName,
    payload.label,
    payload.ariaHaspopup,
  ]
    .map((part) => toString(part).toLowerCase())
    .join(' ');
  const haystack = `${stepHaystack(step)} ${payloadText}`;
  return /modal|dialog|popup|drawer|menu|dropdown|sheet|overlay|popover|toggle|expand|mở|mo_/.test(haystack);
};

const isAsyncTriggerClick = (step) => {
  if (step.inferredAction !== 'click') return false;
  if (isLoginSubmitStep(step)) return true;
  const haystack = stepHaystack(step);
  return /search|submit|save|create|delete|confirm|apply|load|refresh|next|continue|tim.kiem|search-btn/.test(
    haystack,
  );
};

const buildAutoWaitSuggestion = (currentItem, nextItem) => {
  const step = currentItem?.step;
  const nextStep = nextItem?.step;
  if (!step) return '';

  if (isNavigationStep(step)) {
    if (nextStep) {
      return `Gợi ý: thêm bước waitFor cho ${describeStepTarget(nextStep)} sau khi trang tải.`;
    }
    return 'Gợi ý: thêm bước waitFor phần tử chính sau khi trang tải.';
  }

  if (step.inferredAction === 'click') {
    const payload = currentItem.event?.payload || {};

    if (nextStep && isModalTriggerClick(step, payload)) {
      return `Gợi ý: thêm bước waitFor cho ${describeStepTarget(nextStep)} sau khi popup/dialog mở.`;
    }

    if (
      nextStep
      && (nextStep.inferredAction === 'type' || nextStep.inferredAction === 'select')
      && (isAsyncTriggerClick(step) || currentItem.pageUrl !== nextItem.pageUrl)
    ) {
      return `Gợi ý: thêm bước waitFor cho ${describeStepTarget(nextStep)} trước khi thao tác tiếp.`;
    }

    if (isLoginSubmitStep(step)) {
      if (nextStep) {
        return `Gợi ý: thêm bước waitFor cho ${describeStepTarget(nextStep)} sau đăng nhập.`;
      }
      return 'Gợi ý: thêm bước waitFor phần tử sau đăng nhập (vd. menu dashboard).';
    }

    if (nextStep && isAsyncTriggerClick(step)) {
      return `Gợi ý: thêm bước waitFor cho ${describeStepTarget(nextStep)} sau thao tác này.`;
    }
  }

  return '';
};

const applyAutoWaitSuggestionsFromAligned = (aligned) =>
  aligned.map((currentItem, index) => ({
    ...currentItem.step,
    autoWaitSuggestion: buildAutoWaitSuggestion(currentItem, aligned[index + 1]),
  }));

/**
 * SR-3.2: suggest waitFor steps on draft steps (review hint only — not auto-inserted).
 */
const applyAutoWaitSuggestions = (draftSteps, cleanedEvents, baseUrl) => {
  if (!Array.isArray(draftSteps) || !draftSteps.length) {
    return [];
  }

  return applyAutoWaitSuggestionsFromAligned(
    alignDraftStepsWithContext(draftSteps, cleanedEvents, baseUrl),
  );
};

const detectSegmentIntent = (segment) => {
  const steps = segment.map((item) => item.step);
  const pageUrl = segment[0]?.pageUrl || '';

  if (steps.some(isUploadStep)) {
    return { label: 'Upload file' };
  }

  const hasCredential = steps.some(isCredentialFieldStep);
  const hasLoginSubmit = steps.some(isLoginSubmitStep);
  if ((hasCredential && hasLoginSubmit) || (isLoginPageUrl(pageUrl) && hasCredential)) {
    return { label: 'Đăng nhập' };
  }

  if (steps.some(isSearchFieldStep)) {
    return { label: 'Tìm kiếm' };
  }

  let label = 'Thao tác trên trang';
  try {
    const parsed = new URL(pageUrl.startsWith('http') ? pageUrl : `http://local${pageUrl}`);
    const pathPart = parsed.pathname.split('/').filter(Boolean).pop();
    if (pathPart) {
      label = `Thao tác: ${pathPart}`;
    }
  } catch {
    // keep default label
  }

  return { label };
};

/**
 * SR-3.1: group draft steps into intent blocks (login, search, upload, navigation…).
 */
const buildIntentBlocksFromAligned = (aligned) => {
  if (!aligned.length) {
    return [];
  }

  const blocks = [];
  let segment = [];

  const flushSegment = () => {
    if (!segment.length) return;
    const { label } = detectSegmentIntent(segment);
    blocks.push({
      blockId: crypto.randomUUID(),
      label,
      draftStepIds: segment.map((item) => item.step.draftStepId),
    });
    segment = [];
  };

  for (const item of aligned) {
    if (isNavigationStep(item.step)) {
      flushSegment();
      const url = item.step.value || item.step.target || item.pageUrl;
      blocks.push({
        blockId: crypto.randomUUID(),
        label: `Chuyển trang ${url}`,
        draftStepIds: [item.step.draftStepId],
      });
      continue;
    }

    if (segment.length && segment[segment.length - 1].pageUrl !== item.pageUrl) {
      flushSegment();
    }

    segment.push(item);
  }

  flushSegment();
  return blocks;
};

const buildIntentBlocks = (draftSteps, cleanedEvents, baseUrl) => {
  if (!Array.isArray(draftSteps) || !draftSteps.length) {
    return [];
  }

  return buildIntentBlocksFromAligned(
    alignDraftStepsWithContext(draftSteps, cleanedEvents, baseUrl),
  );
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
  const aligned = alignDraftStepsWithContext(
    buildDraftSteps(cleanedEvents, semanticActions, baseUrl),
    cleanedEvents,
    baseUrl,
  );
  const draftSteps = applyAutoWaitSuggestionsFromAligned(aligned);
  const intentBlocks = buildIntentBlocksFromAligned(aligned);

  return {
    events: cleanedEvents,
    semanticActions,
    draftSteps,
    intentBlocks,
  };
};

module.exports = {
  processRecordingEvents,
  filterNoise,
  mergeTypingEvents,
  buildSemanticActions,
  buildDraftSteps,
  buildIntentBlocks,
  applyAutoWaitSuggestions,
};
