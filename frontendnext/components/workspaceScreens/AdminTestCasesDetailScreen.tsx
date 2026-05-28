"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { DataTable, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  selectedProjectId: string;
  detailGroupId: string;
  setDetailGroupId: (value: string) => void;
  scopedGroups: RecordAny[];
  detailLoading: boolean;
  detailRows: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminTestCasesDetailScreen({ selectedProjectId, detailGroupId, setDetailGroupId, scopedGroups, detailLoading, detailRows, matchesSearch }: Props) {
  const safeDetailRows = Array.isArray(detailRows) ? detailRows : [];
  const [focusedCase, setFocusedCase] = useState<RecordAny | null>(null);

  const focusedHistory = Array.isArray(focusedCase?.executionHistory) ? focusedCase.executionHistory : [];

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

  function statusClass(status?: string) {
    if (status === "pass") return "workspace-pill bg-emerald-50 text-emerald-700";
    if (status === "fail") return "workspace-pill bg-rose-50 text-rose-700";
    if (status === "blocked") return "workspace-pill bg-amber-50 text-amber-700";
    if (status === "skip") return "workspace-pill bg-slate-100 text-slate-600";
    return "workspace-pill";
  }

  return (
    <div className="workspace-stack">
      {!selectedProjectId ? (
        <div className="workspace-banner">Hay chon project trong Project scope de xem Test Cases Detail.</div>
      ) : (
        <>
          <SectionCard title="Test Cases Detail" subtitle="Loc theo group va xem 3 status pass/fail/blocked/skip gan nhat">
            <div className="workspace-filterbar">
              <div className="workspace-filterbar__label">
                <span>Group filter</span>
                <p>Chon group de rut gon danh sach test case.</p>
              </div>
              <label className="workspace-filterbar__control">
                <select value={detailGroupId} onChange={(e) => setDetailGroupId(e.target.value)}>
                  <option value="">All groups</option>
                  {scopedGroups.map((group: RecordAny) => <option key={getId(group)} value={getId(group)}>{group.name}</option>)}
                </select>
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Test Case List">
            {detailLoading ? (
              <div className="workspace-table__empty">Loading...</div>
            ) : (
              <DataTable
                columns={["Case", "Group", "Priority", "Recent 1", "Recent 2", "Recent 3", "Action"]}
                rows={safeDetailRows.filter((testCase: RecordAny) => matchesSearch(testCase.caseKey, testCase.title, testCase.group?.name, testCase.priority, ...(testCase.recentStatuses || []))).map((testCase: RecordAny) => {
                  const statuses = Array.isArray(testCase.recentStatuses) ? testCase.recentStatuses : [];
                  const statusCell = (status?: string) => <span className={statusClass(status)}>{status || "-"}</span>;
                  return (
                    <>
                      <div>{testCase.caseKey || testCase.key} - {testCase.title || testCase.name}</div>
                      <div>{testCase.group?.name || "-"}</div>
                      <div>{testCase.priority || "-"}</div>
                      <div>{statusCell(statuses[0])}</div>
                      <div>{statusCell(statuses[1])}</div>
                      <div>{statusCell(statuses[2])}</div>
                      <div>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
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
                {focusedCase.caseKey || focusedCase.key} - {focusedCase.title || focusedCase.name}
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
              <div className="grid grid-cols-[minmax(0,1.3fr)_120px_180px_160px_180px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <div>Run</div>
                <div>Status</div>
                <div>Started by</div>
                <div>Executed at</div>
                <div>Note</div>
              </div>
              <div className="max-h-[55vh] divide-y divide-slate-200 overflow-auto">
                {focusedHistory.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">No execution history found for this case.</div>
                ) : (
                  focusedHistory.map((entry: RecordAny, index: number) => (
                    <div key={`${String(entry.runId || "run")}-${index}`} className="grid grid-cols-[minmax(0,1.3fr)_120px_180px_160px_180px] gap-3 px-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold text-slate-900">{entry.runName || entry.runId || "Run"}</div>
                        <div className="text-xs text-slate-500">{entry.runStatus || "-"}</div>
                      </div>
                      <div><span className={statusClass(entry.status)}>{entry.status || "-"}</span></div>
                      <div className="text-slate-700">{entry.startedBy?.name || entry.startedBy?.email || "-"}</div>
                      <div className="text-slate-600">{entry.executedAt ? new Date(entry.executedAt).toLocaleString() : (entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-")}</div>
                      <div className="text-slate-600">{entry.note || "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}