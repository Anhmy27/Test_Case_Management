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
 * }} input
 */
export const buildRecordedEvent = ({
  rawType,
  pageUrl = '',
  payload = {},
  occurredAt = new Date(),
  eventId,
} = {}) => {
  if (!RECORDED_EVENT_RAW_TYPES.includes(rawType)) {
    throw new Error(`Unsupported rawType: ${rawType}`);
  }

  const occurredAtDate = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error('occurredAt is invalid');
  }

  return {
    eventId: toTrimmed(eventId) || createEventId(),
    rawType,
    occurredAt: occurredAtDate.toISOString(),
    pageUrl: toTrimmed(pageUrl),
    payload: payload && typeof payload === 'object' ? payload : {},
  };
};
