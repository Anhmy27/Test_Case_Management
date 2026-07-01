"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOptionalWorkspaceNotice } from "@/components/workspaceScreens/WorkspaceNotice";
import { apiRequest, userName } from "@/lib/api";
import { formatVietnamDateTime } from "@/lib/vietnamDateTime";
import { formatPriorityLabel } from "@/lib/testCasePriority";
import { StatusBadge } from "./shared";
import type { RunExecutionEntry } from "@/lib/tcmTypes";

type RecordAny = Record<string, any>;

type Props = {
  caseKey: string;
  caseTitle?: string;
  projectId?: string;
  fallbackHistory?: RunExecutionEntry[];
  onClose: () => void;
};

type HistoryResponse = {
  testCases?: RecordAny[];
};

function mapFallbackHistory(entries: RunExecutionEntry[]): RecordAny[] {
  return [...entries]
    .reverse()
    .map((entry) => ({
      runId: entry.runId,
      runName: entry.runName,
      status: entry.status,
      executedAt: entry.executedAt,
      startedBy: entry.tester,
      note: "",
    }));
}

function buildFallbackTestCase(
  caseKey: string,
  caseTitle: string | undefined,
  fallbackHistory: RunExecutionEntry[],
): RecordAny {
  return {
    caseKey,
    title: caseTitle || caseKey,
    executionHistory: mapFallbackHistory(fallbackHistory),
  };
}

function summarizeExecutionHistory(history: RecordAny[]) {
  return history.reduce(
    (acc, entry) => {
      if (entry.status === "pass") acc.pass += 1;
      if (entry.status === "fail") acc.fail += 1;
      if (entry.status === "blocked") acc.blocked += 1;
      if (entry.status === "skip") acc.skip += 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, skip: 0 },
  );
}

export default function TestCaseExecutionHistoryPopup({
  caseKey,
  caseTitle,
  projectId,
  fallbackHistory = [],
  onClose,
}: Props) {
  const noticeContext = useOptionalWorkspaceNotice();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState("");
  const [testCase, setTestCase] = useState<RecordAny | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!projectId) {
        setLoading(false);
        setTestCase(buildFallbackTestCase(caseKey, caseTitle, fallbackHistory));
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          projectId,
          search: caseKey,
        });
        const response = await apiRequest<HistoryResponse>(`/api/test-cases/history?${params.toString()}`);
        if (cancelled) return;

        const normalizedKey = caseKey.trim().toLowerCase();
        const matched = (response.testCases || []).find((row) => {
          const rowKey = String(row.caseKey || row.key || "").trim().toLowerCase();
          return rowKey === normalizedKey;
        });

        if (matched) {
          setTestCase(matched);
          setError("");
          return;
        }

        if (fallbackHistory.length > 0) {
          setTestCase(buildFallbackTestCase(caseKey, caseTitle, fallbackHistory));
          setError("");
          return;
        }

        setError(`No execution history found for case "${caseKey}".`);
        setTestCase(null);
      } catch (loadError) {
        if (cancelled) return;
        if (fallbackHistory.length > 0) {
          setTestCase(buildFallbackTestCase(caseKey, caseTitle, fallbackHistory));
          setError("");
        } else {
          setError(loadError instanceof Error ? loadError.message : "Unable to load execution history");
          setTestCase(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [caseKey, caseTitle, fallbackHistory, projectId]);

  useEffect(() => {
    if (!error || !noticeContext) {
      return;
    }
    noticeContext.showNotice(error, "error");
  }, [error, noticeContext]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const history = Array.isArray(testCase?.executionHistory) ? testCase.executionHistory : [];
  const summary = summarizeExecutionHistory(history);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-history-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution history</div>
              <h3 id="case-history-title" className="truncate text-lg font-semibold text-slate-900 dark:text-zinc-100">
                {testCase
                  ? `${testCase.caseKey || testCase.key} — ${testCase.title || testCase.name || ""}`
                  : `${caseKey}${caseTitle ? ` — ${caseTitle}` : ""}`}
              </h3>
              {testCase?.group?.name || testCase?.priority ? (
                <div className="mt-0.5 text-sm text-slate-500">
                  {[testCase.group?.name, formatPriorityLabel(testCase.priority)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading history...</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-slate-500">Unable to load execution history.</div>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Pass</div>
                  <div className="text-lg font-semibold text-emerald-700">{summary.pass}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Fail</div>
                  <div className="text-lg font-semibold text-rose-700">{summary.fail}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Blocked</div>
                  <div className="text-lg font-semibold text-amber-700">{summary.blocked}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Skip</div>
                  <div className="text-lg font-semibold text-slate-600">{summary.skip}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="grid grid-cols-[minmax(0,1.3fr)_100px_140px_140px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-950">
                  <div>Run</div>
                  <div>Status</div>
                  <div>Started by</div>
                  <div>Executed at</div>
                  <div>Note</div>
                </div>
                {history.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No execution history for this case.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {history.map((entry: RecordAny, index: number) => (
                      <div
                        key={`${String(entry.runId || "run")}-${String(entry.resultId || index)}`}
                        className="grid grid-cols-[minmax(0,1.3fr)_100px_140px_140px_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 dark:text-zinc-100">{entry.runName || entry.runId || "Run"}</div>
                          <div className="text-xs text-slate-500">{entry.runStatus || "-"}</div>
                        </div>
                        <div>{entry.status ? <StatusBadge status={entry.status} /> : <span className="text-slate-400">-</span>}</div>
                        <div className="truncate text-slate-700 dark:text-zinc-300">{userName(entry.startedBy || entry.tester)}</div>
                        <div className="text-xs text-slate-600">
                          {formatVietnamDateTime(entry.executedAt || entry.startedAt)}
                        </div>
                        <div className="truncate text-slate-600 dark:text-zinc-400">{entry.note || "-"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
