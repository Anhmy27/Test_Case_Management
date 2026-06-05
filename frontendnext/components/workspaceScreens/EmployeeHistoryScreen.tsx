"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { getId } from "@/lib/api";
import { Button, DataTable, SectionCard, StatusBadge } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  myScopedRuns: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  loadMyItems: (runId: string) => Promise<void>;
  userName: (value: unknown) => string;
};

export default function EmployeeHistoryScreen({ myScopedRuns, matchesSearch, loadMyItems, userName }: Props) {
  const [focusedRunId, setFocusedRunId] = useState<string>("");

  const completedRuns = myScopedRuns
    .filter((run: RecordAny) => run.status === "completed")
    .filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status, userName(run.startedBy)))
    .slice()
    .sort((left: RecordAny, right: RecordAny) => {
      const leftTime = new Date(left.completedAt || left.endedAt || left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.completedAt || right.endedAt || right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

  const focusedRun = useMemo(
    () => completedRuns.find((run: RecordAny) => String(run?._id || run?.id || "") === String(focusedRunId)) || completedRuns[0] || null,
    [completedRuns, focusedRunId],
  );

  const summary = completedRuns.reduce(
    (acc, run: RecordAny) => {
      acc.total += 1;
      const status = String(run.status || "");
      if (status === "completed") acc.completed += 1;
      return acc;
    },
    { total: 0, completed: 0 },
  );

  return (
    <div className="space-y-5">
      <SectionCard title="Traceability" subtitle="Click run để xem nhanh context liên quan">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-wrap gap-2">
            {completedRuns.slice(0, 10).map((run: RecordAny) => {
              const runId = String(run?._id || run?.id || "");
              const isActive = String(focusedRun?._id || focusedRun?.id || "") === runId;
              return (
                <button
                  key={runId}
                  type="button"
                  onClick={() => setFocusedRunId(runId)}
                  className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:border-slate-300 hover:bg-slate-50 ${
                    isActive ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white"
                  }`}
                >
                  <StatusBadge status={run.status || "completed"} />
                  <span className="font-semibold text-slate-900">{run.name}</span>
                  <span className="text-xs text-slate-500">{run.testPlan?.name || "-"}</span>
                </button>
              );
            })}
          </div>
          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Related context</div>
            {!focusedRun ? (
              <div className="mt-2 text-slate-500">No run selected</div>
            ) : (
              <div className="mt-2 space-y-2">
                <div><strong>Run:</strong> {focusedRun.name || "-"}</div>
                <div><strong>Plan:</strong> {focusedRun.testPlan?.name || "-"}</div>
                <div><strong>Executor:</strong> {userName(focusedRun.startedBy)}</div>
                <div><strong>Completed:</strong> {focusedRun.completedAt || focusedRun.endedAt || focusedRun.updatedAt || "-"}</div>
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                  Trace: Plan → Run → Execution details
                </div>
              </div>
            )}
          </aside>
        </div>
      </SectionCard>

      <SectionCard title="History" subtitle="Lịch sử execution và xu hướng pass/fail">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Completed runs</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Visible</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{completedRuns.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">Trend</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {completedRuns.slice(0, 8).map((run: RecordAny) => (
            <div
              key={getId(run)}
              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
            >
              <StatusBadge status={run.status || "completed"} />
              <strong className="text-slate-900">{run.name}</strong>
              <small className="text-slate-500">{run.testPlan?.name || "-"}</small>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Run Timeline" subtitle="Mở rộng từng run để drill down nhanh hơn">
        <DataTable
          columns={["Run", "Plan", "Status", "Started By", "When", "Action"]}
          rows={completedRuns.map((run: RecordAny) => (
            <>
              <div className="font-medium text-slate-900">{run.name}</div>
              <div className="text-slate-600">{run.testPlan?.name || "-"}</div>
              <div><StatusBadge status={run.status || "completed"} /></div>
              <div className="text-slate-600">{userName(run.startedBy)}</div>
              <div className="text-sm text-slate-600">
                {(run.completedAt || run.endedAt || run.updatedAt || run.createdAt)
                  ? new Date(run.completedAt || run.endedAt || run.updatedAt || run.createdAt).toLocaleString()
                  : "-"}
              </div>
              <div>
                <Button
                  size="sm"
                  label="View"
                  icon="↗"
                  onClick={() => {
                    const runId = String(run?._id || run?.id || "");
                    if (!runId) return;
                    void loadMyItems(runId);
                  }}
                />
              </div>
            </>
          ))}
          emptyText="No history yet"
        />
      </SectionCard>
    </div>
  );
}
