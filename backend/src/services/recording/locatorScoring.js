/**
 * SR-2 — locator scoring for recorded draft steps.
 * Score table + role mapping: AUTOMATION_SMART_RECORD_ROADMAP.md §SR-2.
 */

const toString = (value) => String(value ?? '').trim();

const LOCATOR_SCORES = {
  testid: 100,
  role: 90,
  id: 80,
  label: 75,
  placeholder: 75,
  text: 70,
  css: 50,
};

const pushCandidate = (candidates, strategy, value, { roleName = '', uniqueOnPage = true } = {}) => {
  if (!value) {
    return;
  }
  candidates.push({
    strategy,
    value,
    roleName,
    score: LOCATOR_SCORES[strategy],
    uniqueOnPage,
  });
};

/**
 * Build ranked locator candidates from a recorded element payload.
 * Order follows the roadmap score table; ties keep table order (stable sort).
 * @param {object} payload
 * @returns {{ strategy: string, value: string, roleName: string, score: number, uniqueOnPage: boolean }[]}
 */
const buildLocatorCandidates = (payload = {}) => {
  const candidates = [];

  pushCandidate(candidates, 'testid', toString(payload.testid));

  const role = toString(payload.role);
  const roleName = toString(payload.roleName);
  if (role && roleName) {
    pushCandidate(candidates, 'role', role, { roleName });
  }

  pushCandidate(candidates, 'id', toString(payload.id));
  pushCandidate(candidates, 'label', toString(payload.label));
  pushCandidate(candidates, 'placeholder', toString(payload.placeholder));
  pushCandidate(candidates, 'text', toString(payload.text), { uniqueOnPage: false });
  pushCandidate(candidates, 'css', toString(payload.selector), { uniqueOnPage: false });

  return candidates.sort((left, right) => right.score - left.score);
};

/**
 * Default locator = highest-scoring candidate. Tester can pick another
 * candidate at review time (SR-4) — this never changes automatically at runtime.
 * @param {ReturnType<typeof buildLocatorCandidates>} candidates
 */
const chooseBestLocator = (candidates = []) => {
  const best = candidates[0];
  if (!best) {
    return { targetType: 'css', target: '' };
  }
  return { targetType: best.strategy, target: best.value };
};

module.exports = {
  LOCATOR_SCORES,
  buildLocatorCandidates,
  chooseBestLocator,
};
