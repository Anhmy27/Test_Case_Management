"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setSelectedRunId: (id: string) => void; loadMyItems: (runId: string) => Promise<void>; setActiveTab: (tab: string) => void; userName: (value: unknown) => string; };

export default function EmployeeHistoryScreen({ myScopedRuns, matchesSearch, setSelectedRunId, loadMyItems, setActiveTab, userName }: Props) {
  const completedRuns = myScopedRuns
    .filter((run: RecordAny) => run.status === "completed")
    .filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status, userName(run.startedBy)))
    .slice()
    .sort((left: RecordAny, right: RecordAny) => {
      const leftTime = new Date(left.completedAt || left.endedAt || left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.completedAt || right.endedAt || right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

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
              <div>{new Date(run.completedAt || run.endedAt || run.updatedAt || run.createdAt || Date.now()).toLocaleString()}</div>
              <div>
                <button type="button" className="workspace-secondary" onClick={async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); }}>
                  View
                </button>
              </div>
            </>
          ))}
          emptyText="No history yet"
        />
      </SectionCard>
    </div>
  );
}