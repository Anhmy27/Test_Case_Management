/**
 * SR-2 — locator scoring for recorded draft steps.
 * Score table + role/xpath mapping: AUTOMATION_SMART_RECORD_ROADMAP.md §SR-2 / BL-1.
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
  xpath: 30,
};

/** Escape a string for use inside an XPath literal (prefers single quotes). */
const escapeXPathLiteral = (value) => {
  const text = toString(value);
  if (!text.includes("'")) {
    return `'${text}'`;
  }
  if (!text.includes('"')) {
    return `"${text}"`;
  }
  return `concat(${text.split("'").map((part) => `'${part}'`).join(`, "'", `)})`;
};

/**
 * Build a simple attribute XPath from recorded payload (BL-1).
 * Prefer explicit `payload.xpath` when extension sends one; otherwise derive from testid/id/name.
 */
const buildXPathFromPayload = (payload = {}) => {
  const explicit = toString(payload.xpath);
  if (explicit) {
    return explicit;
  }

  const testid = toString(payload.testid);
  if (testid) {
    return `//*[@data-testid=${escapeXPathLiteral(testid)}]`;
  }

  const id = toString(payload.id);
  if (id) {
    return `//*[@id=${escapeXPathLiteral(id)}]`;
  }

  const name = toString(payload.name);
  if (name) {
    const tag = toString(payload.tagName).toLowerCase() || '*';
    return `//${tag}[@name=${escapeXPathLiteral(name)}]`;
  }

  return '';
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
 * Extension measures real DOM uniqueness at record time (`content-bridge.js` →
 * `payload.locatorUniqueness`) — best-effort per strategy, not always present
 * (older recorded events, manually-added draft steps). Fall back to the previous
 * static assumption (attribute-based strategies assumed unique; text/css/xpath not).
 */
const resolveUniqueOnPage = (uniqueness, strategy, fallback) => {
  if (uniqueness && Object.prototype.hasOwnProperty.call(uniqueness, strategy)) {
    return Boolean(uniqueness[strategy]);
  }
  return fallback;
};

/** Prefer a locator that only matches the recorded element over a higher-scored one that doesn't. */
const sortCandidatesByUniquenessThenScore = (candidates) =>
  candidates.sort((left, right) => {
    if (left.uniqueOnPage !== right.uniqueOnPage) {
      return left.uniqueOnPage ? -1 : 1;
    }
    return right.score - left.score;
  });

/**
 * Build ranked locator candidates from a recorded element payload.
 * Ranking: candidates confirmed unique on page (real DOM check when available) first,
 * then by roadmap score table within each group; ties keep table order (stable sort).
 * @param {object} payload
 * @returns {{ strategy: string, value: string, roleName: string, score: number, uniqueOnPage: boolean }[]}
 */
const buildLocatorCandidates = (payload = {}) => {
  const candidates = [];
  const uniqueness = payload.locatorUniqueness && typeof payload.locatorUniqueness === 'object'
    ? payload.locatorUniqueness
    : null;

  pushCandidate(candidates, 'testid', toString(payload.testid), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'testid', true),
  });

  const role = toString(payload.role);
  const roleName = toString(payload.roleName);
  if (role && roleName) {
    pushCandidate(candidates, 'role', role, {
      roleName,
      uniqueOnPage: resolveUniqueOnPage(uniqueness, 'role', true),
    });
  }

  pushCandidate(candidates, 'id', toString(payload.id), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'id', true),
  });
  pushCandidate(candidates, 'label', toString(payload.label), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'label', true),
  });
  pushCandidate(candidates, 'placeholder', toString(payload.placeholder), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'placeholder', true),
  });
  pushCandidate(candidates, 'text', toString(payload.text), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'text', false),
  });
  pushCandidate(candidates, 'css', toString(payload.selector), {
    uniqueOnPage: resolveUniqueOnPage(uniqueness, 'css', false),
  });
  // BL-1 — lowest score; review fallback when CSS/role still break. Never measured, always last.
  pushCandidate(candidates, 'xpath', buildXPathFromPayload(payload), { uniqueOnPage: false });

  return sortCandidatesByUniquenessThenScore(candidates);
};

/**
 * Actions where step.value carries step content (typed text, file path, key…)
 * and cannot also hold the ARIA accessible name for targetType=role.
 */
const ACTIONS_ROLE_CONFLICTS_VALUE = new Set(['type', 'select', 'upload', 'press', 'dragto']);

const filterCandidatesForAction = (candidates, action) => {
  const normalizedAction = toString(action).toLowerCase();
  if (!ACTIONS_ROLE_CONFLICTS_VALUE.has(normalizedAction)) {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.strategy !== 'role');
};

/**
 * Default locator = first candidate after sorting (unique-on-page first, then score).
 * Tester can pick another candidate at review time (SR-4) — this never changes
 * automatically at runtime.
 * @param {ReturnType<typeof buildLocatorCandidates>} candidates
 * @param {{ chosenLocatorIndex?: number, action?: string }} [options]
 */
const resolveChosenLocator = (candidates = [], { chosenLocatorIndex = 0, action = '' } = {}) => {
  const filtered = filterCandidatesForAction(candidates, action);
  if (!filtered.length) {
    return {
      targetType: 'css',
      target: '',
      locatorDisplayName: '',
      chosenLocatorIndex: 0,
    };
  }

  const requested = Number.isInteger(chosenLocatorIndex) ? chosenLocatorIndex : 0;
  const requestedCandidate = candidates[requested];
  const chosen = requestedCandidate && filtered.includes(requestedCandidate)
    ? requestedCandidate
    : filtered[0];
  const resolvedIndex = Math.max(0, candidates.indexOf(chosen));

  if (chosen.strategy === 'role') {
    return {
      targetType: 'role',
      target: chosen.value,
      locatorDisplayName: toString(chosen.roleName),
      chosenLocatorIndex: resolvedIndex,
    };
  }

  return {
    targetType: chosen.strategy,
    target: chosen.value,
    locatorDisplayName: '',
    chosenLocatorIndex: resolvedIndex,
  };
};

/**
 * Build targetType/target/value for an automation step from a draft step + chosen locator.
 * @param {{ inferredAction?: string, value?: string, locatorCandidates?: object[], chosenLocatorIndex?: number }} draftStep
 */
const applyChosenLocatorToStepFields = (draftStep = {}) => {
  const action = toString(draftStep.inferredAction);
  const contentValue = toString(draftStep.value);
  const resolved = resolveChosenLocator(draftStep.locatorCandidates || [], {
    chosenLocatorIndex: draftStep.chosenLocatorIndex,
    action,
  });

  if (resolved.targetType === 'role') {
    return {
      targetType: resolved.targetType,
      target: resolved.target,
      value: resolved.locatorDisplayName,
      chosenLocatorIndex: resolved.chosenLocatorIndex,
    };
  }

  return {
    targetType: resolved.targetType,
    target: resolved.target,
    value: contentValue,
    chosenLocatorIndex: resolved.chosenLocatorIndex,
  };
};

module.exports = {
  LOCATOR_SCORES,
  applyChosenLocatorToStepFields,
  buildLocatorCandidates,
  filterCandidatesForAction,
  resolveChosenLocator,
};
