import { MAX_EVENTS_PER_APPEND } from './tcmApiConstants.js';

/**
 * Split events into API-sized batches (backend append schema max 100).
 * @param {object[]} events
 * @param {number} [chunkSize]
 */
export const chunkEvents = (events, chunkSize = MAX_EVENTS_PER_APPEND) => {
  const size = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : MAX_EVENTS_PER_APPEND;
  const source = Array.isArray(events) ? events : [];
  const chunks = [];

  for (let index = 0; index < source.length; index += size) {
    chunks.push(source.slice(index, index + size));
  }

  return chunks;
};
