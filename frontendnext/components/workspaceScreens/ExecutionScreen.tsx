"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import ManualRunExecutionPanel from "../execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "../execution/AutomationRunExecutionPanel";
import { SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };
  setRunForm: (updater: any) => void;
  startRun: (event: React.FormEvent) => Promise<void>;
  scopedPlans: RecordAny[];
  selectedRunPlanIsAutomation: boolean;
  selectedRun: RecordAny | null;
  myItems: RecordAny[];
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem?: RecordAny;
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  updateResult: (resultId: string, status: "pass" | "fail" | "blocked" | "skip", note: string, notes: string) => Promise<void>;
  endRun: (runId: string) => Promise<void>;
  canEditSelectedRun: boolean;
  onLogBug?: (run: RecordAny, result: RecordAny) => void;
};

export default function ExecutionScreen(props: Props) {
  const { runForm, setRunForm, startRun, scopedPlans, selectedRunPlanIsAutomation, selectedRun, myItems, selectedItemId, setSelectedItemId, selectedItem, notes, setNotes, updateResult, endRun, canEditSelectedRun, onLogBug } = props;
  
  const handleEndRun = async () => {
    if (!selectedRun) return;

    if (selectedItemId && selectedItem) {
      await updateResult(
        selectedItemId,
        selectedItem.status as "pass" | "fail" | "blocked" | "skip",
        notes[selectedItemId] || selectedItem.note || "",
        notes[`${selectedItemId}:notes`] || selectedItem.notes || "",
      );
    }

    await endRun(selectedRun._id);
  };
  const totalItems = myItems.length;
  const completedItems = myItems.filter((item) => ["pass", "fail", "blocked", "skip"].includes(String(item.status))).length;
  const activeRunCounts = myItems.reduce(
    (acc, item) => {
      const status = String(item.status || "");
      if (status === "pass") acc.pass += 1;
      else if (status === "fail") acc.fail += 1;
      else if (status === "blocked") acc.blocked += 1;
      else if (status === "skip") acc.skip += 1;
      else acc.pending += 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, skip: 0, pending: 0 },
  );

  return (
    <div className="execution-workspace">
      <div className="execution-workspace__top">
        <SectionCard
          title={selectedRun ? "Execution Workbench" : "Start Test Run"}
          subtitle={selectedRun ? "Theo doi progress, status, log va case detail trong 1 workspace" : "Admin co the run moi test plan, assignee chi run plan duoc assign"}
          actions={selectedRun ? [
            <span key="run-status" className={`workspace-pill ${selectedRun.status === "running" ? "workspace-pill--success" : ""}`}>{selectedRun.status}</span>,
            <span key="run-mode" className="workspace-pill">{selectedRun.testPlan?.executionMode || "manual"}</span>,
          ] : undefined}
        >
          <form className="workspace-form execution-launcher" onSubmit={startRun}>
            <div className="workspace-form__grid workspace-form__grid--two">
              <label><span>Test Plan</span><select value={runForm.testPlanId} onChange={(e) => setRunForm((prev: any) => ({ ...prev, testPlanId: e.target.value }))} required><option value="">Select plan</option>{scopedPlans.map((plan: RecordAny) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select></label>
              <label><span>Run name</span><input value={runForm.name} onChange={(e) => setRunForm((prev: any) => ({ ...prev, name: e.target.value }))} required /></label>
            </div>
            <label><span>Automation base URL</span><input value={runForm.baseUrl || ""} onChange={(e) => setRunForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://app.example.com" /></label>
            {selectedRunPlanIsAutomation && <div className="workspace-banner">Playwright sẽ chạy ngay khi bạn start run cho plan automation này.</div>}
            <button className="workspace-primary" type="submit">Start run</button>
          </form>
        </SectionCard>
      </div>

      {selectedRun ? selectedRun.testPlan && String(selectedRun.testPlan.executionMode) === "automation" ? (
        <div className="execution-workbench">
          <SectionCard title="Run Summary" subtitle="Tổng quan execution hiện tại">
            <div className="workspace-metrics workspace-metrics--execution">
              <div className="mini-stat"><span>Cases</span><strong>{totalItems}</strong></div>
              <div className="mini-stat"><span>Done</span><strong>{completedItems}</strong></div>
              <div className="mini-stat"><span>Pass</span><strong>{activeRunCounts.pass}</strong></div>
              <div className="mini-stat"><span>Fail</span><strong>{activeRunCounts.fail}</strong></div>
              <div className="mini-stat"><span>Blocked</span><strong>{activeRunCounts.blocked}</strong></div>
              <div className="mini-stat"><span>Pending</span><strong>{activeRunCounts.pending}</strong></div>
            </div>
          </SectionCard>
          <AutomationRunExecutionPanel selectedRun={selectedRun} myItems={myItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} selectedItem={selectedItem} notes={notes} setNotes={setNotes} onLogBug={onLogBug} />
        </div>
      ) : (
        <div className="execution-workbench">
          <SectionCard title="Run Summary" subtitle="Tổng quan execution hiện tại">
            <div className="workspace-metrics workspace-metrics--execution">
              <div className="mini-stat"><span>Cases</span><strong>{totalItems}</strong></div>
              <div className="mini-stat"><span>Done</span><strong>{completedItems}</strong></div>
              <div className="mini-stat"><span>Pass</span><strong>{activeRunCounts.pass}</strong></div>
              <div className="mini-stat"><span>Fail</span><strong>{activeRunCounts.fail}</strong></div>
              <div className="mini-stat"><span>Blocked</span><strong>{activeRunCounts.blocked}</strong></div>
              <div className="mini-stat"><span>Pending</span><strong>{activeRunCounts.pending}</strong></div>
            </div>
          </SectionCard>
          <ManualRunExecutionPanel selectedRun={selectedRun} myItems={myItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} selectedItem={selectedItem} notes={notes} setNotes={setNotes} onUpdateResult={updateResult} onEndRun={handleEndRun} canEditRun={canEditSelectedRun} onLogBug={onLogBug} />
        </div>
      ) : (
        <div className="workspace-note">Chon hoac start mot test run de bat dau execution.</div>
      )}
    </div>
  );
}