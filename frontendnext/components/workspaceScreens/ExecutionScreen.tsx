"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import ManualRunExecutionPanel from "../execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "../execution/AutomationRunExecutionPanel";
import { getId } from "@/lib/api";

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
    if (!selectedRun || String(selectedRun.status || "") !== "running") {
      return;
    }

    if (canEditSelectedRun && selectedItemId && selectedItem) {
      const status = String(selectedItem.status || "");
      if (["pass", "fail", "blocked", "skip"].includes(status)) {
        await updateResult(
          selectedItemId,
          status as "pass" | "fail" | "blocked" | "skip",
          notes[selectedItemId] || selectedItem.note || "",
          notes[`${selectedItemId}:notes`] || selectedItem.notes || "",
        );
      }
    }

    await endRun(getId(selectedRun));
  };

  const isAutomationRun =
    selectedRunPlanIsAutomation ||
    String(selectedRun?.testPlan?.executionMode || "") === "automation";
  const canEndRun =
    Boolean(selectedRun) &&
    String(selectedRun?.status || "") === "running" &&
    !isAutomationRun &&
    canEditSelectedRun;
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Execution workbench
            </div>
            <div className="text-xl font-semibold text-slate-900">
              {selectedRun ? selectedRun.name : "Start a new test run"}
            </div>
            <div className="text-sm text-slate-500">
              {selectedRun
                ? "Queue, case detail, and result panel in one workspace"
                : "Select a plan and launch a run to start execution"}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selectedRun ? (
              <>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedRun.status === "running"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {selectedRun.status}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedRun.testPlan?.executionMode || "manual"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {completedItems}/{totalItems} done
                </span>
              </>
            ) : null}
          </div>
        </div>

        {!selectedRun && (
          <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={startRun}>
            <label className="block text-xs font-semibold text-slate-500">
              Test plan
              <select
                value={runForm.testPlanId}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, testPlanId: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              >
                <option value="">Select plan</option>
                {scopedPlans.map((plan: RecordAny) => (
                  <option key={getId(plan)} value={getId(plan)}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Run name
              <input
                value={runForm.name}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, name: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Automation base URL
              <input
                value={runForm.baseUrl || ""}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="https://app.example.com"
              />
            </label>
            <button
              type="submit"
              className="h-10 self-end rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start run
            </button>
          </form>
        )}
        {selectedRunPlanIsAutomation && !selectedRun && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Playwright se tu dong chay ngay khi start run cho plan automation.
          </div>
        )}
      </section>

      {selectedRun ? (
        isAutomationRun ? (
          <AutomationRunExecutionPanel
            selectedRun={selectedRun}
            myItems={myItems}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            selectedItem={selectedItem}
            notes={notes}
            setNotes={setNotes}
            onLogBug={onLogBug}
          />
        ) : (
          <ManualRunExecutionPanel
            selectedRun={selectedRun}
            myItems={myItems}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            selectedItem={selectedItem}
            notes={notes}
            setNotes={setNotes}
            onUpdateResult={updateResult}
            onEndRun={handleEndRun}
            canEditRun={canEditSelectedRun}
            canEndRun={canEndRun}
            onLogBug={onLogBug}
          />
        )
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Select a plan and start a run to enter the execution workbench.
        </div>
      )}
    </div>
  );
}