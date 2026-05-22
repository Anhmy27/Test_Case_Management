"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

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
          <button className="workspace-primary" type="submit">Start test run</button>
        </form>
      </SectionCard>

      <SectionCard title="Test Run List" subtitle="Start / completed runs">
        <DataTable columns={["Run", "Plan", "Started by", "Status", "Action"]} rows={adminRuns.filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, userName(run.startedBy), run.status)).map((run: RecordAny) => <><div>{run.name}</div><div>{run.testPlan?.name || "-"}</div><div>{userName(run.startedBy)}</div><div className={run.status === "running" ? "workspace-pill workspace-pill--success" : "workspace-pill"}>{run.status}</div><div><button type="button" className="workspace-secondary" onClick={async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); }}>{run.status === "running" && String(run.startedBy?._id || run.startedBy || "") === currentUserId ? "Open" : "View"}</button></div></>)} emptyText="No runs" />
      </SectionCard>
    </div>
  );
}