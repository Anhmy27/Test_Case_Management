const DEFAULT_AUTOMATION_TIMEOUT_MS = 30000;

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
  normalizeCaseTimeoutMs,
  normalizeTimeoutInputMs,
  resolveStepTimeoutMs,
};
