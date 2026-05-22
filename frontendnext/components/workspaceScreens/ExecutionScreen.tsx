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
  updateResult: (resultId: string, status: "pass" | "fail" | "blocked" | "skip", note: string) => Promise<void>;
  endRun: (runId: string) => Promise<void>;
  canEditSelectedRun: boolean;
};

export default function ExecutionScreen(props: Props) {
  const { runForm, setRunForm, startRun, scopedPlans, selectedRunPlanIsAutomation, selectedRun, myItems, selectedItemId, setSelectedItemId, selectedItem, notes, setNotes, updateResult, endRun, canEditSelectedRun } = props;

  return (
    <div className="execution-workspace">
      <div className="execution-workspace__top">
        <SectionCard title="Start Test Run" subtitle="Admin co the run moi test plan, assignee chi run plan duoc assign">
          <form className="workspace-form" onSubmit={startRun}>
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
        <AutomationRunExecutionPanel selectedRun={selectedRun} myItems={myItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} selectedItem={selectedItem} notes={notes} setNotes={setNotes} />
      ) : (
        <ManualRunExecutionPanel selectedRun={selectedRun} myItems={myItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} selectedItem={selectedItem} notes={notes} setNotes={setNotes} onUpdateResult={updateResult} onEndRun={() => endRun(selectedRun._id)} canEditRun={canEditSelectedRun} />
      ) : (
        <div className="workspace-note">Chon hoac start mot test run de bat dau execution.</div>
      )}
    </div>
  );
}