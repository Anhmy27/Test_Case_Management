"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { getRunDocumentId } from "@/components/jira/jiraBugUtils";
import { matchesSelectedEntity } from "@/lib/api";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; loadMyItems: (runId: string) => Promise<void>; userName: (value: unknown) => string; };

export default function EmployeeRunningTestsScreen({ myScopedRuns, matchesSearch, loadMyItems, userName }: Props) {
  const [focusedRunId, setFocusedRunId] = useState<string>("");

  const runningRuns = myScopedRuns
    .filter((run: RecordAny) => run.status === "running")
    .filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status, run.progress));

  const focusedRun = useMemo(
    () => runningRuns.find((run: RecordAny) => matchesSelectedEntity(run, focusedRunId)) || runningRuns[0] || null,
    [focusedRunId, runningRuns],
  );

  return (
    <div className="space-y-5">
      <SectionCard title="Running Tests" subtitle="Run đang chạy của bạn">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <DataTable
            columns={["Run", "Plan", "Progress", "Status", "Action"]}
            rows={runningRuns.map((run: RecordAny) => (
              <>
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setFocusedRunId(getRunDocumentId(run))}>{run.name}</button>
                <div>{run.testPlan?.name || "-"}</div>
                <div>{typeof run.progress === "number" ? `${run.progress.toFixed(1)}%` : "0%"}</div>
                <div>{run.status}</div>
                <div><ActionButton label="Open" icon="↗" onClick={() => { const runId = getRunDocumentId(run); if (!runId) return; void loadMyItems(runId); }} /></div>
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