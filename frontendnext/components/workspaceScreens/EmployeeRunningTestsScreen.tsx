"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setSelectedRunId: (id: string) => void; loadMyItems: (runId: string) => Promise<void>; setActiveTab: (tab: string) => void; userName: (value: unknown) => string; };

export default function EmployeeRunningTestsScreen({ myScopedRuns, matchesSearch, setSelectedRunId, loadMyItems, setActiveTab, userName }: Props) {
  const [focusedRunId, setFocusedRunId] = useState<string>("");

  const runningRuns = myScopedRuns
    .filter((run: RecordAny) => run.status === "running")
    .filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status, run.progress));

  const focusedRun = useMemo(
    () => runningRuns.find((run: RecordAny) => String(run?._id || run?.id || "") === String(focusedRunId)) || runningRuns[0] || null,
    [focusedRunId, runningRuns],
  );

  return (
    <div className="workspace-stack">
      <SectionCard title="Running Tests" subtitle="Run dang chay cua ban">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <DataTable
            columns={["Run", "Plan", "Progress", "Status", "Action"]}
            rows={runningRuns.map((run: RecordAny) => (
              <>
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setFocusedRunId(String(run?._id || run?.id || ""))}>{run.name}</button>
                <div>{run.testPlan?.name || "-"}</div>
                <div>{typeof run.progress === "number" ? `${run.progress.toFixed(1)}%` : "0%"}</div>
                <div>{run.status}</div>
                <div><ActionButton label="Open" icon="↗" onClick={() => void (async () => { const runId = String(run?._id || run?.id || ""); setSelectedRunId(runId); await loadMyItems(runId); setActiveTab("execution"); })()} /></div>
              </>
            ))}
            emptyText="No running tests"
          />
          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Related panel</div>
            {!focusedRun ? (
              <div className="mt-2 text-slate-500">No running run selected</div>
            ) : (
              <div className="mt-2 space-y-2">
                <div><strong>Run:</strong> {focusedRun.name || "-"}</div>
                <div><strong>Plan:</strong> {focusedRun.testPlan?.name || "-"}</div>
                <div><strong>Progress:</strong> {typeof focusedRun.progress === "number" ? `${focusedRun.progress.toFixed(1)}%` : "0%"}</div>
                <div><strong>Executor:</strong> {userName(focusedRun.startedBy)}</div>
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">Trace: Plan → Running Run → Execution Items</div>
              </div>
            )}
          </aside>
        </div>
      </SectionCard>
    </div>
  );
}