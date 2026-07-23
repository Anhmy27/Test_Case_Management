/** Keep in sync with backend/src/config/recordingConfig.js RECORDED_EVENT_RAW_TYPES */

export const RECORDED_EVENT_RAW_TYPES = [
  'click',
  'input',
  'change',
  'submit',
  'navigation',
  'file_upload',
  'select_change',
  'keypress',
];

export const MAX_PAYLOAD_TEXT_LENGTH = 200;
export const MAX_SELECTOR_LENGTH = 300;

/**
 * Raw types worth a screenshot/DOM snapshot (BL-2). Deliberately excludes
 * `input` / `keypress` — those fire per keystroke, would spam
 * `chrome.tabs.captureVisibleTab` (per-second rate limit) and get merged
 * into one draft step by the backend pipeline anyway (see mergeTypingEvents).
 */
export const VISUAL_CAPTURE_RAW_TYPES = ['click', 'change', 'submit', 'navigation', 'file_upload', 'select_change'];

/** Client-side DOM snapshot cap (chars) — stay safely under backend maxDomBytes (1MB, recordingConfig.js). */
export const MAX_DOM_HTML_LENGTH = 300_000;
