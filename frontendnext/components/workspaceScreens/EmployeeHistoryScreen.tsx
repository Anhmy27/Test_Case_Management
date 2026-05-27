"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setSelectedRunId: (id: string) => void; loadMyItems: (runId: string) => Promise<void>; setActiveTab: (tab: string) => void; userName: (value: unknown) => string; };

export default function EmployeeHistoryScreen({ myScopedRuns, matchesSearch, setSelectedRunId, loadMyItems, setActiveTab, userName }: Props) {
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
    () => completedRuns.find((run: RecordAny) => String(run._id) === String(focusedRunId)) || completedRuns[0] || null,
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
    <div className="workspace-stack">
      <SectionCard title="Traceability" subtitle="Click run de xem nhanh context lien quan">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="workspace-history-strip">
            {completedRuns.slice(0, 10).map((run: RecordAny) => {
              const isActive = String(focusedRun?._id || "") === String(run._id);
              return (
                <button
                  key={run._id}
                  type="button"
                  onClick={() => setFocusedRunId(String(run._id))}
                  className={`workspace-history-strip__item text-left ${isActive ? "ring-2 ring-indigo-300" : ""}`}
                >
                  <span className="workspace-pill status-pass">{run.status || "completed"}</span>
                  <strong>{run.name}</strong>
                  <small>{run.testPlan?.name || "-"}</small>
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

      <SectionCard title="History" subtitle="Lich su execution va xu huong pass/fail">
        <div className="workspace-metrics workspace-metrics--wide">
          <div className="mini-stat"><span>Completed runs</span><strong>{summary.total}</strong></div>
          <div className="mini-stat"><span>Visible</span><strong>{completedRuns.length}</strong></div>
          <div className="mini-stat"><span>Status</span><strong>Trend</strong></div>
        </div>
        <div className="workspace-history-strip">
          {completedRuns.slice(0, 8).map((run: RecordAny) => {
            const label = String(run.status || "completed");
            const toneClass = label === "completed" ? "status-pass" : "status-skip";
            return (
              <div key={run._id} className="workspace-history-strip__item">
                <span className={`workspace-pill ${toneClass}`}>{label}</span>
                <strong>{run.name}</strong>
                <small>{run.testPlan?.name || "-"}</small>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Run Timeline" subtitle="Mo rong tung run de drill down nhanh hon">
        <DataTable
          columns={["Run", "Plan", "Status", "Started By", "When", "Action"]}
          rows={completedRuns.map((run: RecordAny) => (
            <>
              <div>{run.name}</div>
              <div>{run.testPlan?.name || "-"}</div>
              <div><span className="workspace-pill workspace-pill--success">{run.status}</span></div>
              <div>{userName(run.startedBy)}</div>
              <div>{run.completedAt || run.endedAt || run.updatedAt || run.createdAt ? new Date(run.completedAt || run.endedAt || run.updatedAt || run.createdAt).toLocaleString() : "-"}</div>
              <div>
                <ActionButton label="View" icon="↗" onClick={() => void (async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); })()} />
              </div>
            </>
          ))}
          emptyText="No history yet"
        />
      </SectionCard>
    </div>
  );
}