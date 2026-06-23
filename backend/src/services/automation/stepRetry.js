/** P4 — retry từng bước khi lỗi tạm thời (timeout, chưa actionable…). */

const DEFAULT_STEP_RETRY_COUNT = 2;

const NON_RETRY_PATTERNS = [
  /Locator matched \d+ elements/i,
  /Locator matched 0 elements/i,
  /Authentication required/i,
  /Unsupported automation action/i,
  /requires a URL/i,
  /requires expected/i,
  /requires a target/i,
  /requires at least one file/i,
  /requires source target/i,
  /requires a key combination/i,
  /AUTOMATION_CANCELLED/i,
  /Expected text to include/i,
  /Expected page url to include/i,
  /Expected page title to include/i,
  /Expected element to be enabled/i,
  /Expected element to be checked/i,
];

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /not actionable/i,
  /not visible/i,
  /intercepts pointer/i,
  /waiting for/i,
  /Target closed/i,
  /net::ERR/i,
  /Navigation failed/i,
  /Execution context was destroyed/i,
  /element is not enabled/i,
  /element is not attached/i,
  /strict mode violation/i,
];

const isTransientStepError = (error) => {
  const message = String(error?.message || '');

  if (NON_RETRY_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
};

/**
 * @param {() => Promise<string>} runAttempt
 * @param {{ maxRetries?: number }} options
 * @returns {Promise<string>}
 */
const runStepWithRetries = async (runAttempt, { maxRetries = DEFAULT_STEP_RETRY_COUNT } = {}) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await runAttempt();
      if (attempt === 0) {
        return result;
      }
      return `${result}\n(step retried ${attempt} time(s) after transient error)`;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxRetries && isTransientStepError(error);
      if (!canRetry) {
        throw error;
      }
    }
  }

  throw lastError;
};

module.exports = {
  DEFAULT_STEP_RETRY_COUNT,
  isTransientStepError,
  runStepWithRetries,
};
