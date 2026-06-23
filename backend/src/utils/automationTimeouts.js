const DEFAULT_AUTOMATION_TIMEOUT_MS = 30000;

const GOTO_WAIT_UNTIL_VALUES = new Set(['load', 'domcontentloaded']);
const DEFAULT_GOTO_WAIT_UNTIL = 'load';

const normalizeGotoWaitUntil = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'domcontentloaded') {
    return 'domcontentloaded';
  }
  return DEFAULT_GOTO_WAIT_UNTIL;
};

const normalizeTimeoutInputMs = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return raw < 1000 ? raw * 1000 : raw;
};

const normalizeCaseTimeoutMs = (value, fallbackMs = DEFAULT_AUTOMATION_TIMEOUT_MS) => {
  return normalizeTimeoutInputMs(value) ?? fallbackMs;
};

const resolveStepTimeoutMs = (
  stepTimeoutMs,
  caseTimeoutMs,
  fallbackMs = DEFAULT_AUTOMATION_TIMEOUT_MS,
) => {
  return (
    normalizeTimeoutInputMs(stepTimeoutMs)
    ?? normalizeTimeoutInputMs(caseTimeoutMs)
    ?? fallbackMs
  );
};

module.exports = {
  DEFAULT_AUTOMATION_TIMEOUT_MS,
  DEFAULT_GOTO_WAIT_UNTIL,
  GOTO_WAIT_UNTIL_VALUES,
  normalizeCaseTimeoutMs,
  normalizeGotoWaitUntil,
  normalizeTimeoutInputMs,
  resolveStepTimeoutMs,
};
