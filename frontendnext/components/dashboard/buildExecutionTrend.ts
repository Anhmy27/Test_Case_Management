import {
  formatVietnamDate,
  formatVietnamDateLabel,
  shiftVietnamDateKey,
  toVietnamDateKey,
} from "@/lib/vietnamDateTime";

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

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return formatVietnamDateLabel(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
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
  const todayKey = toVietnamDateKey(new Date()) || formatVietnamDate(new Date());

  const buckets = new Map<string, ExecutionTrendPoint>();
  for (let offset = safeDayCount - 1; offset >= 0; offset -= 1) {
    const date = shiftVietnamDateKey(todayKey, -offset);
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      runs: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
    });
  }

  const bucketKeys = Array.from(buckets.keys()).sort();
  const windowStart = bucketKeys[0];
  const windowEnd = bucketKeys[bucketKeys.length - 1];

  for (const run of testRuns) {
    const dateKey = toVietnamDateKey(run.startedAt) || toVietnamDateKey(run.createdAt);
    if (!dateKey) {
      continue;
    }

    if (dateKey < windowStart || dateKey > windowEnd) {
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
