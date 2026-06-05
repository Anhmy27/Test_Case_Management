"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import ManualRunExecutionPanel from "../execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "../execution/AutomationRunExecutionPanel";
import TestRunListSection from "./TestRunListSection";
import { Button, Field, INPUT_CLS, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };
  setRunForm: (updater: any) => void;
  startRun: (event: React.FormEvent) => Promise<void>;
  startingRun?: boolean;
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
  canControlAutomationRun?: boolean;
  cancellingRun?: boolean;
  retryingRun?: boolean;
  onCancelAutomationRun?: () => Promise<void>;
  onRetryFailedAutomation?: () => Promise<void>;
  token: string;
  onLogBug?: (run: RecordAny, result: RecordAny) => void;
  adminRuns?: RecordAny[];
  onOpenRun?: (runId: string) => void;
  currentUserId?: string;
  userName?: (value: unknown) => string;
  matchesSearch?: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function ExecutionScreen(props: Props) {
  const {
    runForm,
    setRunForm,
    startRun,
    startingRun = false,
    scopedPlans,
    selectedRunPlanIsAutomation,
    selectedRun,
    myItems,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    notes,
    setNotes,
    updateResult,
    endRun,
    canEditSelectedRun,
    canControlAutomationRun = false,
    cancellingRun = false,
    retryingRun = false,
    onCancelAutomationRun,
    onRetryFailedAutomation,
    token,
    onLogBug,
    adminRuns,
    onOpenRun,
    currentUserId = "",
    userName = () => "Unassigned",
    matchesSearch = () => true,
  } = props;

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
  const completedItems = myItems.filter((item) =>
    ["pass", "fail", "blocked", "skip"].includes(String(item.status)),
  ).length;
  const showRunList = Array.isArray(adminRuns) && typeof onOpenRun === "function";

  return (
    <div className="space-y-6">
      <SectionCard title="Start Test Run" subtitle="Chọn test plan và khởi chạy test run mới">
        <form className="space-y-4" onSubmit={startRun}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test Plan">
              <select
                className={INPUT_CLS}
                value={runForm.testPlanId}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, testPlanId: e.target.value }))}
                required
                disabled={startingRun}
              >
                <option value="">Select plan</option>
                {scopedPlans.map((plan: RecordAny) => (
                  <option key={getId(plan)} value={getId(plan)}>
                    {plan.name} ({plan.executionMode || "manual"})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Run name">
              <input
                className={INPUT_CLS}
                value={runForm.name}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, name: e.target.value }))}
                required
                disabled={startingRun}
              />
            </Field>
          </div>
          {selectedRunPlanIsAutomation && (
            <Field label="Automation base URL">
              <input
                className={INPUT_CLS}
                value={runForm.baseUrl || ""}
                onChange={(e) => setRunForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://app.example.com"
                disabled={startingRun}
              />
            </Field>
          )}
          {selectedRunPlanIsAutomation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Plan automation: Playwright chạy ngay khi Start run. Theo dõi tiến độ ở execution workbench bên dưới.
            </div>
          )}
          <Button type="submit" variant="primary" loading={startingRun} disabled={startingRun}>
            {startingRun
              ? selectedRunPlanIsAutomation
                ? "Đang chạy Playwright..."
                : "Đang start run..."
              : "▶ Start test run"}
          </Button>
        </form>
      </SectionCard>

      {selectedRun ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Execution workbench
                </div>
                <div className="text-xl font-semibold text-slate-900">{selectedRun.name}</div>
                <div className="text-sm text-slate-500">
                  Queue, case detail, and result panel in one workspace
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedRun.status === "running"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {selectedRun.status}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedRun.testPlan?.executionMode || "manual"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {completedItems}/{totalItems} done
                </span>
              </div>
            </div>
          </section>

          {isAutomationRun ? (
            <AutomationRunExecutionPanel
              selectedRun={selectedRun}
              myItems={myItems}
              selectedItemId={selectedItemId}
              setSelectedItemId={setSelectedItemId}
              selectedItem={selectedItem}
              notes={notes}
              setNotes={setNotes}
              token={token}
              canControlRun={canControlAutomationRun}
              cancellingRun={cancellingRun}
              retryingRun={retryingRun}
              onCancelRun={onCancelAutomationRun}
              onRetryFailed={onRetryFailedAutomation}
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
          )}
        </>
      ) : showRunList ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Chọn một run trong danh sách bên dưới hoặc start run mới để mở execution workbench.
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Select a plan and start a run to enter the execution workbench.
        </div>
      )}

      {showRunList ? (
        <TestRunListSection
          runs={adminRuns}
          scopedPlans={scopedPlans}
          matchesSearch={matchesSearch}
          userName={userName}
          currentUserId={currentUserId}
          onOpenRun={onOpenRun}
          activeRunId={selectedRun ? getId(selectedRun) : ""}
        />
      ) : null}
    </div>
  );
}
