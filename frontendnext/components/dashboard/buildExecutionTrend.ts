export type ExecutionTrendPoint = {
  date: string;
  label: string;
  runs: number;
  pass: number;
  fail: number;
  blocked: number;
};

type TrendRun = {
  startedAt?: string | Date | null;
  createdAt?: string | Date | null;
  results?: Array<{ status?: string | null }> | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function countResultStatuses(results: TrendRun["results"]) {
  const safeResults = Array.isArray(results) ? results : [];
  let pass = 0;
  let fail = 0;
  let blocked = 0;

  for (const result of safeResults) {
    if (result?.status === "pass") {
      pass += 1;
    } else if (result?.status === "fail") {
      fail += 1;
    } else if (result?.status === "blocked") {
      blocked += 1;
    }
  }

  return { pass, fail, blocked };
}

export function buildExecutionTrendPoints(
  testRuns: TrendRun[],
  dayCount = 14,
): ExecutionTrendPoint[] {
  const safeDayCount = Math.max(1, dayCount);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, ExecutionTrendPoint>();
  for (let offset = safeDayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * DAY_MS);
    const date = day.toISOString().slice(0, 10);
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      runs: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
    });
  }

  const windowStart = today.getTime() - (safeDayCount - 1) * DAY_MS;
  const windowEnd = today.getTime() + DAY_MS - 1;

  for (const run of testRuns) {
    const dateKey = toDateKey(run.startedAt) || toDateKey(run.createdAt);
    if (!dateKey) {
      continue;
    }

    const runTime = new Date(`${dateKey}T12:00:00`).getTime();
    if (runTime < windowStart || runTime > windowEnd) {
      continue;
    }

    const bucket = buckets.get(dateKey);
    if (!bucket) {
      continue;
    }

    bucket.runs += 1;
    const { pass, fail, blocked } = countResultStatuses(run.results);
    bucket.pass += pass;
    bucket.fail += fail;
    bucket.blocked += blocked;
  }

  return Array.from(buckets.values());
}
