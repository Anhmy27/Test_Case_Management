/* Classic content script (no import/export) — Chrome injects this as a plain script. */
(function initTcmRecordingContent() {
  if (globalThis.__tcmRecordingContentLoaded) {
    return;
  }
  globalThis.__tcmRecordingContentLoaded = true;

  const MESSAGE = {
    GET_RECORDING_STATE: 'tcm-recording:get-state',
    SET_RECORDING_STATE: 'tcm-recording:set-state',
    RECORDED_EVENT: 'tcm-recording:recorded-event',
  };

  const RECORDED_EVENT_RAW_TYPES = [
    'click',
    'input',
    'change',
    'submit',
    'navigation',
    'file_upload',
    'select_change',
    'keypress',
  ];
  const MAX_PAYLOAD_TEXT_LENGTH = 200;
  const MAX_SELECTOR_LENGTH = 300;
  const VISUAL_CAPTURE_RAW_TYPES = [
    'click',
    'change',
    'submit',
    'navigation',
    'file_upload',
    'select_change',
  ];
  const MAX_DOM_HTML_LENGTH = 300000;
  const IGNORED_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'meta', 'link']);

  const toTrimmed = (value) => String(value ?? '').trim();

  const truncate = (value, maxLength) => {
    const text = toTrimmed(value);
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength);
  };

  const createEventId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const buildRecordedEvent = ({
    rawType,
    pageUrl = '',
    payload = {},
    occurredAt = new Date(),
    eventId,
    domHtml = '',
  } = {}) => {
    if (!RECORDED_EVENT_RAW_TYPES.includes(rawType)) {
      throw new Error(`Unsupported rawType: ${rawType}`);
    }

    const occurredAtDate = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    if (Number.isNaN(occurredAtDate.getTime())) {
      throw new Error('occurredAt is invalid');
    }

    const event = {
      eventId: toTrimmed(eventId) || createEventId(),
      rawType,
      occurredAt: occurredAtDate.toISOString(),
      pageUrl: toTrimmed(pageUrl),
      payload: payload && typeof payload === 'object' ? payload : {},
    };

    const trimmedDomHtml = typeof domHtml === 'string' ? domHtml.trim() : '';
    if (trimmedDomHtml) {
      event.domHtml = trimmedDomHtml;
    }

    return event;
  };

  const getLabelText = (element) => {
    if (!(element instanceof Element)) {
      return '';
    }
    if (element.id) {
      const forLabel = element.ownerDocument?.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (forLabel) {
        return toTrimmed(forLabel.textContent);
      }
    }
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return toTrimmed(parentLabel.textContent);
    }
    return toTrimmed(element.getAttribute('aria-label'));
  };

  const getVisibleText = (element) => {
    if (!(element instanceof Element)) {
      return '';
    }
    const ariaLabel = toTrimmed(element.getAttribute('aria-label'));
    if (ariaLabel) {
      return ariaLabel;
    }
    const text = toTrimmed(element.textContent);
    if (text.length <= MAX_PAYLOAD_TEXT_LENGTH) {
      return text;
    }
    return text.slice(0, MAX_PAYLOAD_TEXT_LENGTH);
  };

  const getImplicitRole = (element) => {
    if (!(element instanceof Element)) {
      return '';
    }
    const explicitRole = toTrimmed(element.getAttribute('role'));
    if (explicitRole) {
      return explicitRole;
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'button') return 'button';
    if (tagName === 'a' && element.hasAttribute('href')) return 'link';
    if (tagName === 'select') return 'combobox';
    if (tagName === 'textarea') return 'textbox';
    if (tagName === 'input') {
      const type = toTrimmed(element.getAttribute('type')).toLowerCase() || 'text';
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      return 'textbox';
    }
    return '';
  };

  const domDescriptorFromElement = (element) => {
    if (!(element instanceof Element)) {
      return {};
    }
    const tagName = element.tagName.toLowerCase();
    const role = getImplicitRole(element);
    const roleName = getVisibleText(element)
      || getLabelText(element)
      || toTrimmed(element.getAttribute('placeholder'));

    const descriptor = {
      tagName,
      testid: toTrimmed(element.getAttribute('data-testid')),
      id: toTrimmed(element.id),
      name: toTrimmed(element.getAttribute('name')),
      placeholder: toTrimmed(element.getAttribute('placeholder')),
      label: getLabelText(element),
      text: getVisibleText(element),
      role,
      roleName,
    };

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      descriptor.value = element.value;
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        descriptor.checked = element.checked;
      }
    } else if (element instanceof HTMLSelectElement) {
      descriptor.value = element.value;
    }

    if (element instanceof HTMLInputElement && element.type === 'file') {
      descriptor.files = Array.from(element.files || []).map((file) => file.name);
    }

    return descriptor;
  };

  const escapeCssAttributeValue = (value) => toTrimmed(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const buildSimpleSelector = (descriptor) => {
    const testid = toTrimmed(descriptor.testid);
    if (testid) {
      return `[data-testid="${escapeCssAttributeValue(testid)}"]`;
    }
    const id = toTrimmed(descriptor.id);
    if (id && !id.includes(' ')) {
      return `#${escapeCssAttributeValue(id)}`;
    }
    const name = toTrimmed(descriptor.name);
    const tagName = toTrimmed(descriptor.tagName).toLowerCase() || '*';
    if (name) {
      return `${tagName}[name="${escapeCssAttributeValue(name)}"]`;
    }
    return truncate(tagName, MAX_SELECTOR_LENGTH);
  };

  const elementPayloadFromDescriptor = (descriptor = {}) => {
    const payload = {
      tagName: truncate(descriptor.tagName, 40),
      testid: truncate(descriptor.testid, 120),
      id: truncate(descriptor.id, 120),
      name: truncate(descriptor.name, 120),
      placeholder: truncate(descriptor.placeholder, 160),
      label: truncate(descriptor.label, 160),
      text: truncate(descriptor.text, MAX_PAYLOAD_TEXT_LENGTH),
      role: truncate(descriptor.role, 40),
      roleName: truncate(descriptor.roleName, MAX_PAYLOAD_TEXT_LENGTH),
      selector: truncate(descriptor.selector || buildSimpleSelector(descriptor), MAX_SELECTOR_LENGTH),
    };

    if (descriptor.value !== undefined && descriptor.value !== null) {
      payload.value = truncate(descriptor.value, 500);
    }
    if (descriptor.checked === true) {
      payload.checked = true;
    }
    if (descriptor.files && Array.isArray(descriptor.files)) {
      payload.files = descriptor.files.map((file) => truncate(file, 260)).filter(Boolean);
    }

    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => {
        if (value === '' || value === false || value === undefined || value === null) {
          return false;
        }
        if (Array.isArray(value) && value.length === 0) {
          return false;
        }
        return true;
      }),
    );
  };

  let isRecording = false;
  let captureVisuals = false;
  let allowedOrigin = '';
  let lastNavigationUrl = window.location.href;

  const isPageAllowedForRecording = (pageUrl) => {
    if (!allowedOrigin) {
      return false;
    }
    try {
      return new URL(pageUrl || window.location.href).origin === allowedOrigin;
    } catch {
      return false;
    }
  };

  const captureDomHtmlIfNeeded = (rawType) => {
    if (!captureVisuals || !VISUAL_CAPTURE_RAW_TYPES.includes(rawType)) {
      return '';
    }
    try {
      return document.documentElement.outerHTML.slice(0, MAX_DOM_HTML_LENGTH);
    } catch {
      return '';
    }
  };

  const sendRuntimeMessage = (message) => {
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // Extension context may be invalidated during reload.
    }
  };

  const requestRecordingState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE.GET_RECORDING_STATE });
      isRecording = Boolean(response?.isRecording);
      captureVisuals = Boolean(response?.captureVisuals);
      allowedOrigin = typeof response?.allowedOrigin === 'string' ? response.allowedOrigin : '';
    } catch {
      isRecording = false;
      captureVisuals = false;
      allowedOrigin = '';
    }
  };

  const buildEventFromElement = (rawType, element, extraPayload = {}) => {
    const descriptor = domDescriptorFromElement(element);
    const payload = {
      ...elementPayloadFromDescriptor(descriptor),
      ...extraPayload,
    };
    return buildRecordedEvent({
      rawType,
      pageUrl: window.location.href,
      payload,
      domHtml: captureDomHtmlIfNeeded(rawType),
    });
  };

  const emitRecordedEvent = (event) => {
    if (!isRecording || !event) {
      return;
    }
    if (!isPageAllowedForRecording(event.pageUrl)) {
      return;
    }
    sendRuntimeMessage({
      type: MESSAGE.RECORDED_EVENT,
      event,
    });
  };

  const shouldIgnoreTarget = (element) => {
    if (!(element instanceof Element)) {
      return true;
    }
    return IGNORED_TAGS.has(element.tagName.toLowerCase());
  };

  const resolveEventElement = (target) => {
    if (target instanceof Element) {
      return target;
    }
    if (target instanceof Text && target.parentElement) {
      return target.parentElement;
    }
    return null;
  };

  const onDocumentClick = (event) => {
    if (!isRecording || !event.isTrusted) {
      return;
    }
    const element = resolveEventElement(event.target);
    if (!element || shouldIgnoreTarget(element)) {
      return;
    }
    emitRecordedEvent(buildEventFromElement('click', element));
  };

  const onDocumentInput = (event) => {
    if (!isRecording || !event.isTrusted) {
      return;
    }
    const element = resolveEventElement(event.target);
    if (!element || shouldIgnoreTarget(element)) {
      return;
    }
    if (element instanceof HTMLInputElement && element.type === 'file') {
      return;
    }
    emitRecordedEvent(buildEventFromElement('input', element));
  };

  const onDocumentChange = (event) => {
    if (!isRecording || !event.isTrusted) {
      return;
    }
    const element = resolveEventElement(event.target);
    if (!element || shouldIgnoreTarget(element)) {
      return;
    }
    if (element instanceof HTMLInputElement && element.type === 'file') {
      emitRecordedEvent(buildEventFromElement('file_upload', element, {
        value: Array.from(element.files || []).map((file) => file.name).join(', '),
      }));
      return;
    }
    if (element instanceof HTMLSelectElement) {
      emitRecordedEvent(buildEventFromElement('select_change', element));
      return;
    }
    emitRecordedEvent(buildEventFromElement('change', element));
  };

  const onDocumentKeyPress = (event) => {
    if (!isRecording || !event.isTrusted || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const element = resolveEventElement(event.target);
    if (!element || shouldIgnoreTarget(element)) {
      return;
    }
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return;
    }
    emitRecordedEvent(buildRecordedEvent({
      rawType: 'keypress',
      pageUrl: window.location.href,
      payload: {
        ...elementPayloadFromDescriptor(domDescriptorFromElement(element)),
        value: event.key.length === 1 ? event.key : '',
      },
    }));
  };

  const onDocumentSubmit = (event) => {
    if (!isRecording || !event.isTrusted) {
      return;
    }
    const element = resolveEventElement(event.target);
    if (!(element instanceof HTMLFormElement)) {
      return;
    }
    emitRecordedEvent(buildRecordedEvent({
      rawType: 'submit',
      pageUrl: window.location.href,
      payload: {
        tagName: 'form',
        id: element.id || '',
        name: element.getAttribute('name') || '',
        selector: element.id ? `#${element.id}` : 'form',
      },
      domHtml: captureDomHtmlIfNeeded('submit'),
    }));
  };

  const emitNavigationIfChanged = (reason = 'navigation') => {
    const nextUrl = window.location.href;
    if (nextUrl === lastNavigationUrl) {
      return;
    }
    lastNavigationUrl = nextUrl;
    emitRecordedEvent(buildRecordedEvent({
      rawType: 'navigation',
      pageUrl: nextUrl,
      payload: {
        reason,
        value: nextUrl,
      },
      domHtml: captureDomHtmlIfNeeded('navigation'),
    }));
  };

  const patchHistoryApi = () => {
    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      if (typeof original !== 'function') {
        return;
      }
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        emitNavigationIfChanged(methodName);
        return result;
      };
    };
    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
  };

  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('input', onDocumentInput, true);
  document.addEventListener('change', onDocumentChange, true);
  document.addEventListener('keypress', onDocumentKeyPress, true);
  document.addEventListener('submit', onDocumentSubmit, true);
  window.addEventListener('popstate', () => emitNavigationIfChanged('popstate'));
  window.addEventListener('hashchange', () => emitNavigationIfChanged('hashchange'));
  window.addEventListener('pageshow', () => emitNavigationIfChanged('pageshow'));
  patchHistoryApi();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE.SET_RECORDING_STATE) {
      isRecording = Boolean(message.isRecording);
      captureVisuals = Boolean(message.captureVisuals);
      allowedOrigin = typeof message.allowedOrigin === 'string' ? message.allowedOrigin : '';
      if (isRecording) {
        lastNavigationUrl = window.location.href;
      }
      sendResponse({ ok: true, isRecording });
      return true;
    }
    return false;
  });

  void requestRecordingState();
  console.info('[TCM Recording] content script sẵn sàng trên', window.location.href);
})();
