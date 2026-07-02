import { buildRecordedEvent } from '../lib/buildRecordedEvent.js';
import { domDescriptorFromElement } from '../lib/domDescriptorFromElement.js';
import { elementPayloadFromDescriptor } from '../lib/elementPayloadFromDescriptor.js';
import { MESSAGE } from '../lib/messages.js';

const IGNORED_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'meta', 'link']);

let isRecording = false;
let lastNavigationUrl = window.location.href;

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
  } catch {
    isRecording = false;
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
  });
};

const emitRecordedEvent = (event) => {
  if (!isRecording || !event) {
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

const registerNavigationListeners = () => {
  window.addEventListener('popstate', () => emitNavigationIfChanged('popstate'));
  window.addEventListener('hashchange', () => emitNavigationIfChanged('hashchange'));
  window.addEventListener('pageshow', () => emitNavigationIfChanged('pageshow'));
  patchHistoryApi();
};

const registerCaptureListeners = () => {
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('input', onDocumentInput, true);
  document.addEventListener('change', onDocumentChange, true);
  document.addEventListener('keypress', onDocumentKeyPress, true);
  document.addEventListener('submit', onDocumentSubmit, true);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE.SET_RECORDING_STATE) {
    isRecording = Boolean(message.isRecording);
    if (isRecording) {
      lastNavigationUrl = window.location.href;
    }
    sendResponse({ ok: true, isRecording });
    return true;
  }

  return false;
});

registerCaptureListeners();
registerNavigationListeners();
requestRecordingState();
