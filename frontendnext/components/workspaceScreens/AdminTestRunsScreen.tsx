"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };
  setRunForm: Dispatch<SetStateAction<{ testPlanId: string; name: string; baseUrl: string }>>;
  startRun: (event: React.FormEvent) => Promise<void>;
  scopedPlans: RecordAny[];
  selectedRunPlanIsAutomation: boolean;
  adminRuns: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  currentUserId: string;
  setSelectedRunId: Dispatch<SetStateAction<string>>;
  loadMyItems: (runId: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
};

export default function AdminTestRunsScreen({ runForm, setRunForm, startRun, scopedPlans, selectedRunPlanIsAutomation, adminRuns, matchesSearch, userName, currentUserId, setSelectedRunId, loadMyItems, setActiveTab }: Props) {
  const [focusedRunId, setFocusedRunId] = useState<string>("");
  const filteredRuns = useMemo(
    () => adminRuns.filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, userName(run.startedBy), run.status, run.progress)),
    [adminRuns, matchesSearch, userName],
  );
  const focusedRun = useMemo(
    () => filteredRuns.find((run: RecordAny) => String(run._id) === String(focusedRunId)) || filteredRuns[0] || null,
    [filteredRuns, focusedRunId],
  );
  const relatedRuns = useMemo(() => {
    if (!focusedRun) return [];
    const focusedPlanId = String(focusedRun.testPlan?._id || focusedRun.testPlan || "");
    return filteredRuns
      .filter((run: RecordAny) => String(run.testPlan?._id || run.testPlan || "") === focusedPlanId)
      .sort(
        (a: RecordAny, b: RecordAny) =>
          new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 8);
  }, [filteredRuns, focusedRun]);

  return (
    <div className="workspace-stack">
      <SectionCard title="Test Runs" subtitle="Theo doi execution va start/end run rieng">
        <form className="workspace-form" onSubmit={startRun}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Test Plan</span><select value={runForm.testPlanId} onChange={(e) => setRunForm((prev) => ({ ...prev, testPlanId: e.target.value }))} required><option value="">Select plan</option>{scopedPlans.map((plan: RecordAny) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select></label>
            <label><span>Run name</span><input value={runForm.name} onChange={(e) => setRunForm((prev) => ({ ...prev, name: e.target.value }))} required /></label>
          </div>
          <label><span>Automation base URL</span><input value={runForm.baseUrl || ""} onChange={(e) => setRunForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://app.example.com" /></label>
          {selectedRunPlanIsAutomation && <div className="workspace-banner">Automation plan đã được chọn. Khi bạn start run, Playwright sẽ chạy ngay với base URL này.</div>}
          <ActionButton label="Start test run" icon="▶" variant="primary" />
        </form>
      </SectionCard>

      <SectionCard title="Test Run List" subtitle="Start / completed runs">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <DataTable columns={["Run", "Plan", "Progress", "Started by", "Status", "Action"]} rows={filteredRuns.map((run: RecordAny) => <><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setFocusedRunId(String(run._id))}>{run.name}</button><div>{run.testPlan?.name || "-"}</div><div>{typeof run.progress === "number" ? `${run.progress.toFixed(1)}%` : "0%"}</div><div>{userName(run.startedBy)}</div><div className={run.status === "running" ? "workspace-pill workspace-pill--success" : "workspace-pill"}>{run.status}</div><div><ActionButton label={run.status === "running" && String(run.startedBy?._id || run.startedBy || "") === currentUserId ? "Open" : "View"} icon="↗" onClick={() => void (async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); })()} /></div></>)} emptyText="No runs" />
          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Run context</div>
            {!focusedRun ? <div className="mt-2 text-slate-500">No run selected</div> : <div className="mt-2 space-y-2"><div><strong>Run:</strong> {focusedRun.name || "-"}</div><div><strong>Plan:</strong> {focusedRun.testPlan?.name || "-"}</div><div><strong>Status:</strong> {focusedRun.status || "-"}</div><div><strong>Progress:</strong> {typeof focusedRun.progress === "number" ? `${focusedRun.progress.toFixed(1)}%` : "0%"}</div><div><strong>Started by:</strong> {userName(focusedRun.startedBy)}</div><div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">Run Context = ngữ cảnh của run đang chọn (plan nguồn, trạng thái, người chạy, tiến độ, và các execution items thuộc run này).</div><div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600"><div className="mb-1 font-semibold text-slate-700">Run history của plan này</div>{relatedRuns.length === 0 ? <div className="text-slate-500">No related runs</div> : <div className="space-y-1">{relatedRuns.map((run: RecordAny) => <div key={String(run._id)} className="flex items-center justify-between"><span className="truncate">{run.name || "Run"}</span><span className="ml-2 text-slate-500">{run.status || "-"}</span></div>)}</div>}</div></div>}
          </aside>
        </div>
      </SectionCard>
    </div>
  );
}