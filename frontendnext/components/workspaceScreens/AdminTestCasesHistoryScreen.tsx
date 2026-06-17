"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import ExecutionHistoryEntryActions from "@/components/execution/ExecutionHistoryEntryActions";
import ExecutionHistoryScreenshotModal from "@/components/execution/ExecutionHistoryScreenshotModal";
import { DataTable, Field, INPUT_CLS, SectionCard, StatusBadge } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  selectedProjectId: string;
  detailGroupId: string;
  setDetailGroupId: (value: string) => void;
  scopedGroups: RecordAny[];
  detailLoading: boolean;
  detailRows: RecordAny[];
  highlightCaseKey?: string;
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  onOpenRunResult?: (runId: string, resultId: string) => void;
  onLogBugForResult?: (runId: string, resultId: string) => void | Promise<void>;
};

export default function AdminTestCasesHistoryScreen({
  selectedProjectId,
  detailGroupId,
  setDetailGroupId,
  scopedGroups,
  detailLoading,
  detailRows,
  highlightCaseKey = "",
  matchesSearch,
  onOpenRunResult,
  onLogBugForResult,
}: Props) {
  const safeDetailRows = useMemo(
    () => (Array.isArray(detailRows) ? detailRows : []),
    [detailRows],
  );
  const [focusedCase, setFocusedCase] = useState<RecordAny | null>(null);
  const [screenshotTarget, setScreenshotTarget] = useState<{ runId: string; resultId: string } | null>(null);
  const consumedHighlightRef = useRef("");

  useEffect(() => {
    const query = highlightCaseKey.trim().toLowerCase();
    if (!query || detailLoading || safeDetailRows.length === 0) {
      return;
    }
    if (consumedHighlightRef.current === query) {
      return;
    }

    const matched = safeDetailRows.find((testCase: RecordAny) => {
      const caseKey = String(testCase.caseKey || testCase.key || "").toLowerCase();
      const title = String(testCase.title || testCase.name || "").toLowerCase();
      return caseKey.includes(query) || title.includes(query) || query.includes(caseKey);
    });

    if (matched) {
      setFocusedCase(matched);
      consumedHighlightRef.current = query;
    }
  }, [detailLoading, highlightCaseKey, safeDetailRows]);

  const focusedHistory = useMemo(
    () =>
      Array.isArray(focusedCase?.executionHistory) ? focusedCase.executionHistory : [],
    [focusedCase],
  );

  const focusedSummary = useMemo(() => {
    return focusedHistory.reduce(
      (acc, entry: RecordAny) => {
        if (entry.status === "pass") acc.pass += 1;
        if (entry.status === "fail") acc.fail += 1;
        if (entry.status === "blocked") acc.blocked += 1;
        if (entry.status === "skip") acc.skip += 1;
        return acc;
      },
      { pass: 0, fail: 0, blocked: 0, skip: 0 },
    );
  }, [focusedHistory]);

  function statusCell(status?: string) {
    return status ? <StatusBadge status={status} /> : <span className="text-slate-400">-</span>;
  }

  return (
    <div className="space-y-5">
      {!selectedProjectId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hãy chọn project trong Project scope để xem Execution History.
        </div>
      ) : (
        <>
          <SectionCard title="Execution History" subtitle="Lọc theo group, xem 3 lần chạy gần nhất">
            <div className="flex flex-wrap items-end gap-4">
              <div className="shrink-0">
                <p className="text-xs font-semibold text-slate-700">Group filter</p>
                <p className="mt-0.5 text-xs text-slate-500">Chọn group để rút gọn danh sách test case.</p>
              </div>
              <Field label="Group">
                <select
                  className={INPUT_CLS}
                  value={detailGroupId}
                  onChange={(e) => setDetailGroupId(e.target.value)}
                >
                  <option value="">All groups</option>
                  {scopedGroups.map((group: RecordAny) => (
                    <option key={getId(group)} value={getId(group)}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Test Case List">
            {detailLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
            ) : (
              <DataTable
                columns={["Key", "Title", "Group", "Priority", "Recent 1", "Recent 2", "Recent 3", "Action"]}
                rows={safeDetailRows
                  .filter((testCase: RecordAny) =>
                    matchesSearch(testCase.caseKey, testCase.title, testCase.group?.name, testCase.priority, ...(testCase.recentStatuses || [])),
                  )
                  .map((testCase: RecordAny) => {
                    const statuses = Array.isArray(testCase.recentStatuses) ? testCase.recentStatuses : [];
                    return (
                      <>
                        <div className="font-semibold text-slate-900">{testCase.caseKey || testCase.key || "-"}</div>
                        <div>{testCase.title || testCase.name || "-"}</div>
                        <div>{testCase.group?.name || "-"}</div>
                        <div>{testCase.priority || "-"}</div>
                        <div>{statusCell(statuses[0])}</div>
                        <div>{statusCell(statuses[1])}</div>
                        <div>{statusCell(statuses[2])}</div>
                        <div>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            onClick={() => setFocusedCase(testCase)}
                          >
                            View all
                          </button>
                        </div>
                      </>
                    );
                  })}
                emptyText="No test cases in this project"
              />
            )}
          </SectionCard>
        </>
      )}

      {focusedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setFocusedCase(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution history</div>
              <h3 className="text-xl font-semibold text-slate-900">
                <span className="font-semibold">{focusedCase.caseKey || focusedCase.key || "-"}</span>
                <span className="mx-2 font-normal text-slate-400">·</span>
                <span>{focusedCase.title || focusedCase.name || "-"}</span>
              </h3>
              <div className="text-sm text-slate-600">
                {focusedCase.group?.name || "-"} · {focusedCase.priority || "-"}
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Pass</div>
                <div className="text-lg font-semibold text-emerald-700">{focusedSummary.pass}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Fail</div>
                <div className="text-lg font-semibold text-rose-700">{focusedSummary.fail}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Blocked</div>
                <div className="text-lg font-semibold text-amber-700">{focusedSummary.blocked}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Skip</div>
                <div className="text-lg font-semibold text-slate-600">{focusedSummary.skip}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1.1fr)_100px_140px_150px_minmax(0,1fr)_minmax(140px,180px)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <div>Run</div>
                <div>Status</div>
                <div>Started by</div>
                <div>Executed at</div>
                <div>Note</div>
                <div>Actions</div>
              </div>
              <div className="max-h-[55vh] divide-y divide-slate-200 overflow-auto">
                {focusedHistory.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">No execution history found for this case.</div>
                ) : (
                  focusedHistory.map((entry: RecordAny, index: number) => (
                    <div key={`${String(entry.runId || "run")}-${String(entry.resultId || index)}`} className="grid grid-cols-[minmax(0,1.1fr)_100px_140px_150px_minmax(0,1fr)_minmax(140px,180px)] gap-3 px-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold text-slate-900">{entry.runName || entry.runId || "Run"}</div>
                        <div className="text-xs text-slate-500">{entry.runStatus || "-"}</div>
                      </div>
                      <div>{entry.status ? <StatusBadge status={entry.status} /> : <span className="text-slate-400">-</span>}</div>
                      <div className="text-slate-700">{entry.startedBy?.name || entry.startedBy?.email || "-"}</div>
                      <div className="text-slate-600">{entry.executedAt ? new Date(entry.executedAt).toLocaleString() : (entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-")}</div>
                      <div className="break-words text-slate-600">{entry.note || "-"}</div>
                      <div>
                        <ExecutionHistoryEntryActions
                          entry={entry}
                          onOpenRun={onOpenRunResult}
                          onViewScreenshot={(runId, resultId) => setScreenshotTarget({ runId, resultId })}
                          onLogBug={onLogBugForResult}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {screenshotTarget ? (
        <ExecutionHistoryScreenshotModal
          runId={screenshotTarget.runId}
          resultId={screenshotTarget.resultId}
          caseLabel={`${focusedCase?.caseKey || focusedCase?.key || "-"} · ${focusedCase?.title || focusedCase?.name || ""}`}
          onClose={() => setScreenshotTarget(null)}
        />
      ) : null}
    </div>
  );
}

