const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
const CSRF_COOKIE = 'tcm_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

function readBrowserCookie(name: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// short in-memory cache + in-flight dedupe for GET requests to reduce burst pressure
const _inflight = new Map<string, Promise<unknown>>();
const _cache = new Map<string, { ts: number; data: unknown }>();
const _CACHE_TTL_MS = 800;

export async function apiRequest<T>(
  path: string,
  token?: string,
  options?: RequestInit
): Promise<T> {
  const method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
  const isGetNoBody = method === 'GET' && options?.body == null;
  const isVolatileGet = isGetNoBody && (
    path.startsWith('/api/test-runs') ||
    path.startsWith('/api/dashboard')
  );

  // build a stable key including authorization to avoid leaking other users' cache
  const authKey = token ? `|${token}` : '|cookie';
  const cacheKey = `${method}:${path}${authKey}`;

  if (method !== 'GET') {
    // Mutations can stale any recent GET cache entry.
    _cache.clear();
    _inflight.clear();
  }

  if (isGetNoBody && !isVolatileGet) {
    // return recent cached response
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < _CACHE_TTL_MS) {
      return Promise.resolve(cached.data as T);
    }
    // if identical request already in flight, reuse its promise
    const inflight = _inflight.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }
  const headers: Record<string, string> = {};

  if (options?.headers) {
    const optionHeaders = new Headers(options.headers);
    optionHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrfToken = readBrowserCookie(CSRF_COOKIE);
    if (csrfToken) {
      headers[CSRF_HEADER] = csrfToken;
    }
  }

  const fetchPromise = fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
    credentials: 'include',
    headers,
  }).then(async (response) => {
    // Safely handle empty responses (204 No Content or empty body)
    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // If response is not JSON, preserve raw text
        data = text;
      }
    }

    if (response.status === 304 && isGetNoBody) {
      const cached = _cache.get(cacheKey);
      if (cached) {
        return cached.data as T;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: unknown }).message || text || "Request failed")
          : String(text || "Request failed");
      throw new Error(message);
    }

    // cache GET responses briefly
    if (isGetNoBody && !isVolatileGet) {
      try {
        _cache.set(cacheKey, { ts: Date.now(), data });
      } catch {}
    }

    return data as T;
  }).finally(() => {
    if (isGetNoBody && !isVolatileGet) {
      _inflight.delete(cacheKey);
    }
  });

  if (isGetNoBody && !isVolatileGet) {
    _inflight.set(cacheKey, fetchPromise as Promise<unknown>);
  }

  const response = await fetchPromise;
  return response as T;
}

export function collectEntityIds(value: unknown): Set<string> {
  const ids = new Set<string>();

  const add = (candidate: unknown) => {
    const normalized = String(candidate || "").trim();
    if (normalized) {
      ids.add(normalized);
    }
  };

  if (!value) {
    return ids;
  }

  if (typeof value === "string") {
    add(value);
    return ids;
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as { entityId?: unknown; _id?: unknown; id?: unknown };
    add(obj.entityId);
    add(obj._id);
    add(obj.id);
    add(getId(value));
  }

  return ids;
}

export function matchesSelectedEntity(value: unknown, selectedId: string) {
  const normalizedSelectedId = String(selectedId || "").trim();
  if (!normalizedSelectedId) {
    return true;
  }

  return collectEntityIds(value).has(normalizedSelectedId);
}

export function createTextMatcher(searchTerm = "") {
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();

  return (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch),
    );
  };
}

export function getId(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as { entityId?: unknown; _id?: unknown; id?: unknown };
    // prefer entityId, then _id, then id
    if (obj.entityId) return String(obj.entityId);
    if (obj._id) return String(obj._id);
    if (obj.id) return String(obj.id);
    return '';
  }

  return '';
}

export function userName(value: unknown): string {
  if (!value) {
    return 'Unassigned';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { name?: unknown; email?: unknown };
    return String(candidate.name || candidate.email || 'Unknown');
  }

  return 'Unknown';
}

export const CASE_STATUSES = ['untested', 'pass', 'fail', 'blocked', 'skip'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const RUN_STATUSES = ['running', 'completed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const EXECUTION_MODES = ['manual', 'automation'] as const;

export const END_RUN_POLICY_STORAGE_KEY = 'tcm_end_run_policy';
export const END_RUN_POLICIES = ['flexible', 'strict'] as const;
export type EndRunPolicy = (typeof END_RUN_POLICIES)[number];

export type RunResultsSummary = {
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  untested: number;
  done: number;
  /** Matches the `progress` field returned by the backend API (computeRunProgress in testRunLifecycleService.js). Keep formulas in sync. */
  progress: number;
  passRate: number;
};

export type AutomationRunSummary = {
  total?: number;
  pass?: number;
  fail?: number;
  blocked?: number;
  skip?: number;
};

export function normalizeCaseStatus(status?: string | null): CaseStatus {
  const key = String(status || 'untested').toLowerCase();
  return (CASE_STATUSES as readonly string[]).includes(key) ? (key as CaseStatus) : 'untested';
}

export function summarizeRunResults(items: Array<{ status?: string }>): RunResultsSummary {
  const summary: RunResultsSummary = {
    total: items.length,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
    untested: 0,
    done: 0,
    progress: 0,
    passRate: 0,
  };

  for (const item of items) {
    const status = normalizeCaseStatus(item.status);
    if (status === 'pass') summary.pass += 1;
    else if (status === 'fail') summary.fail += 1;
    else if (status === 'blocked') summary.blocked += 1;
    else if (status === 'skip') summary.skip += 1;
    else summary.untested += 1;
  }

  summary.done = summary.pass + summary.fail + summary.blocked + summary.skip;
  summary.progress = summary.total > 0
    ? Number(((summary.done / summary.total) * 100).toFixed(2))
    : 0;

  const verdictCount = summary.pass + summary.fail + summary.blocked;
  summary.passRate = verdictCount > 0
    ? Number(((summary.pass / verdictCount) * 100).toFixed(2))
    : 0;

  return summary;
}

export function isValidHttpUrl(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildDefaultRunName(planName: string, versionName?: string): string {
  const safePlan = String(planName || 'Test plan').trim() || 'Test plan';
  const safeVersion = String(versionName || '').trim();
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return safeVersion ? `${safePlan} - ${safeVersion} - ${stamp}` : `${safePlan} - ${stamp}`;
}

export function getPlanCaseCount(plan: { items?: unknown[] } | null | undefined): number {
  return Array.isArray(plan?.items) ? plan.items.length : 0;
}

export type StartRunValidationInput = {
  testPlanId: string;
  name: string;
  baseUrl: string;
  plan: {
    executionMode?: string;
    items?: unknown[];
    name?: string;
    version?: { name?: string };
    entityId?: string;
    _id?: string;
  } | null;
  existingRuns?: Array<{ name?: string; testPlan?: unknown }>;
  allPlans?: Array<{ entityId?: string; _id?: string }>;
};

export function getPlanEntityId(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as { entityId?: unknown; _id?: unknown };
    const entityId = String(obj.entityId || '').trim();
    if (entityId) {
      return entityId;
    }
    return String(obj._id || getId(value) || '').trim();
  }

  return String(value).trim();
}

function buildPlanMatchIds(
  plan: unknown,
  allPlans: Array<{ entityId?: string; _id?: string }> = [],
): Set<string> {
  const ids = new Set<string>();
  const entityId = getPlanEntityId(plan);

  collectEntityIds(plan).forEach((id) => ids.add(id));

  if (!entityId) {
    return ids;
  }

  ids.add(entityId);
  for (const candidate of allPlans) {
    if (getPlanEntityId(candidate) === entityId) {
      collectEntityIds(candidate).forEach((id) => ids.add(id));
    }
  }

  return ids;
}

function resolveRunPlanEntityId(
  runPlan: unknown,
  allPlans: Array<{ entityId?: string; _id?: string }> = [],
): string {
  if (typeof runPlan === 'object' && runPlan !== null) {
    const entityId = getPlanEntityId(runPlan);
    if (entityId) {
      return entityId;
    }
  }

  const runPlanIds = collectEntityIds(runPlan);
  for (const candidate of allPlans) {
    const candidateIds = collectEntityIds(candidate);
    for (const id of runPlanIds) {
      if (candidateIds.has(id)) {
        return getPlanEntityId(candidate);
      }
    }
  }

  return [...runPlanIds][0] || '';
}

export function isDuplicateRunInPlan(
  runs: Array<{ name?: string; testPlan?: unknown }>,
  plan: unknown,
  name: string,
  allPlans: Array<{ entityId?: string; _id?: string }> = [],
): boolean {
  const normalizedName = normalizeRunName(name).toLowerCase();
  if (!normalizedName) {
    return false;
  }

  const targetEntityId = getPlanEntityId(plan);
  const targetPlanIds = buildPlanMatchIds(plan, allPlans);
  if (!targetEntityId && !targetPlanIds.size) {
    return false;
  }

  return runs.some((run) => {
    const runName = normalizeRunName(run.name).toLowerCase();
    if (runName !== normalizedName) {
      return false;
    }

    const runEntityId = resolveRunPlanEntityId(run.testPlan, allPlans);
    if (targetEntityId && runEntityId && runEntityId === targetEntityId) {
      return true;
    }

    const runPlanIds = collectEntityIds(run.testPlan);
    for (const id of runPlanIds) {
      if (targetPlanIds.has(id)) {
        return true;
      }
    }

    return false;
  });
}

export function normalizeRunName(value: unknown): string {
  return String(value || '').trim();
}

export function validateStartRunForm(input: StartRunValidationInput): string | null {
  if (!input.testPlanId) {
    return 'Test plan is required';
  }

  if (!input.plan) {
    return 'Test plan not found';
  }

  if (getPlanCaseCount(input.plan) === 0) {
    return 'Plan has no test cases';
  }

  const resolvedName = normalizeRunName(input.name)
    || buildDefaultRunName(input.plan.name || '', input.plan.version?.name);

  if (!resolvedName) {
    return 'Run name is required';
  }

  if (isDuplicateRunInPlan(input.existingRuns || [], input.plan, resolvedName, input.allPlans || [])) {
    return 'Run name already exists in this plan';
  }

  if (String(input.plan.executionMode || 'manual') === 'automation') {
    if (!isValidHttpUrl(input.baseUrl)) {
      return 'Base URL is invalid';
    }
  }

  return null;
}

export function resolveStartRunPayload(input: StartRunValidationInput) {
  const error = validateStartRunForm(input);
  if (error) {
    return { error, payload: null as null };
  }

  const plan = input.plan!;
  const name = normalizeRunName(input.name)
    || buildDefaultRunName(plan.name || '', plan.version?.name);

  return {
    error: null as null,
    payload: {
      testPlanId: input.testPlanId,
      name,
      baseUrl: String(input.baseUrl || '').trim(),
    },
  };
}

export function getEndRunPolicy(): EndRunPolicy {
  if (typeof window === 'undefined') {
    return 'flexible';
  }

  const stored = String(window.localStorage.getItem(END_RUN_POLICY_STORAGE_KEY) || '').trim();
  return (END_RUN_POLICIES as readonly string[]).includes(stored)
    ? (stored as EndRunPolicy)
    : 'flexible';
}

export function setEndRunPolicy(policy: EndRunPolicy) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(END_RUN_POLICY_STORAGE_KEY, policy);
}

export function getRunListActionLabel(runStatus: string, isActive: boolean): string {
  const normalizedStatus = String(runStatus || '').toLowerCase();
  if (normalizedStatus === 'running') {
    return 'Open';
  }
  return isActive ? 'Viewing' : 'View';
}

export function formatRunProgressPercent(value: number | undefined | null): string {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

export function formatAutomationRunMessage(summary?: AutomationRunSummary | null): string {
  if (!summary) {
    return 'Automation run completed.';
  }

  return `Automation hoàn tất: ${summary.pass ?? 0} pass, ${summary.fail ?? 0} fail, ${summary.blocked ?? 0} blocked, ${summary.skip ?? 0} skip / ${summary.total ?? 0} cases.`;
}

export function summarizeAutomationResults(items: Array<{ status?: string }>): AutomationRunSummary {
  const summary = summarizeRunResults(items);
  return {
    total: summary.total,
    pass: summary.pass,
    fail: summary.fail,
    blocked: summary.blocked,
    skip: summary.skip,
  };
}

export function getAutomationRunProgress(items: Array<{ status?: string }>) {
  const summary = summarizeRunResults(items);
  return {
    total: summary.total,
    finished: summary.done,
    percent: Math.round(summary.progress),
  };
}

export type AutomationProgress = {
  currentCaseIndex?: number;
  totalCases?: number;
  currentStepIndex?: number;
  currentStepTotal?: number;
  currentCaseKey?: string;
  cancelRequested?: boolean;
};

export function formatAutomationLiveProgress(
  progress?: AutomationProgress | null,
  fallback?: { finished: number; total: number },
) {
  const caseIndex = Number(progress?.currentCaseIndex || fallback?.finished || 0);
  const caseTotal = Number(progress?.totalCases || fallback?.total || 0);
  const stepIndex = Number(progress?.currentStepIndex || 0);
  const stepTotal = Number(progress?.currentStepTotal || 0);
  const caseKey = String(progress?.currentCaseKey || '').trim();

  const parts: string[] = [];
  if (caseTotal > 0) {
    parts.push(`Case ${caseIndex}/${caseTotal}`);
  }
  if (stepTotal > 0) {
    parts.push(`Step ${stepIndex}/${stepTotal}`);
  }
  if (caseKey) {
    parts.push(caseKey);
  }

  return parts.join(' · ') || 'Đang khởi động...';
}

function parseContentDispositionFilename(headerValue: string | null, fallback: string) {
  if (!headerValue) {
    return fallback;
  }

  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
}

export async function downloadTestRunExport(
  runId: string,
  format: 'xlsx' | 'csv' = 'xlsx',
) {
  const normalizedRunId = String(runId || '').trim();
  if (!normalizedRunId) {
    throw new Error('Run id is required');
  }

  const headers: Record<string, string> = {};
  const csrfToken = readBrowserCookie(CSRF_COOKIE);
  if (csrfToken) {
    headers[CSRF_HEADER] = csrfToken;
  }

  const response = await fetch(
    `${API_BASE}/api/test-runs/${encodeURIComponent(normalizedRunId)}/export?format=${encodeURIComponent(format)}`,
    {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Export failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(
    response.headers.get('Content-Disposition'),
    `test-run-results.${format}`,
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

