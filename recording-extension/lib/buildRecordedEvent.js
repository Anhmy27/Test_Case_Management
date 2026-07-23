import { RECORDED_EVENT_RAW_TYPES } from './recordedEventConstants.js';
import { toTrimmed } from './textUtils.js';

const createEventId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Build one recorded event matching backend recordedEventInputSchema.
 * @param {{
 *   rawType: string,
 *   pageUrl?: string,
 *   payload?: object,
 *   occurredAt?: string | Date,
 *   eventId?: string,
 *   domHtml?: string,
 * }} input
 */
export const buildRecordedEvent = ({
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

  // Screenshot is attached later by the background service worker (only it can call
  // chrome.tabs.captureVisibleTab); domHtml comes from the content script (has DOM access).
  const trimmedDomHtml = typeof domHtml === 'string' ? domHtml.trim() : '';
  if (trimmedDomHtml) {
    event.domHtml = trimmedDomHtml;
  }

  return event;
};
