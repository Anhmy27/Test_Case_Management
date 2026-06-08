"use client";



/* eslint-disable @typescript-eslint/no-explicit-any */



import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import ManualRunExecutionPanel from "../execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "../execution/AutomationRunExecutionPanel";
import TestRunListSection from "./TestRunListSection";
import { Button, Field, INPUT_CLS, SectionCard, StatusBadge } from "./shared";
import { buildDefaultRunName, getPlanCaseCount, summarizeRunResults, getId, validateStartRunForm } from "@/lib/api";



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

  startRunError?: string;

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

    userName = () => "Unassigned",

    matchesSearch = () => true,

    startRunError = "",

  } = props;

  const selectedRunPlan = useMemo(
    () => scopedPlans.find((plan: RecordAny) => getId(plan) === runForm.testPlanId) || selectedRun?.testPlan || null,
    [runForm.testPlanId, scopedPlans, selectedRun],
  );

  const runSummary = useMemo(() => summarizeRunResults(myItems), [myItems]);
  const defaultRunNamePreview = useMemo(
    () => buildDefaultRunName(selectedRunPlan?.name || "", selectedRunPlan?.version?.name),
    [selectedRunPlan],
  );
  const liveStartRunError = useMemo(() => {
    if (!runForm.testPlanId || !selectedRunPlan) {
      return "";
    }

    return validateStartRunForm({
      testPlanId: runForm.testPlanId,
      name: runForm.name,
      baseUrl: runForm.baseUrl || "",
      plan: selectedRunPlan,
      existingRuns: adminRuns || [],
      allPlans: scopedPlans,
    }) || "";
  }, [adminRuns, runForm.baseUrl, runForm.name, runForm.testPlanId, scopedPlans, selectedRunPlan]);
  const displayedStartRunError = startRunError || liveStartRunError;



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

  const showRunList = Array.isArray(adminRuns) && typeof onOpenRun === "function";
  const startedAtLabel = selectedRun?.startedAt
    ? new Date(selectedRun.startedAt).toLocaleString()
    : "-";



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

                placeholder={defaultRunNamePreview}

                disabled={startingRun}

              />

            </Field>

          </div>

          {selectedRunPlan && getPlanCaseCount(selectedRunPlan) === 0 ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Selected plan has no test cases. Add cases to the plan before starting a run.
            </div>
          ) : null}

          {displayedStartRunError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {displayedStartRunError}
            </div>
          ) : null}

          {selectedRunPlanIsAutomation && (

            <Field label="Automation base URL">

              <input

                className={INPUT_CLS}

                value={runForm.baseUrl || ""}

                onChange={(e) => setRunForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))}

                placeholder="https://app.example.com"

                required

                disabled={startingRun}

              />

            </Field>

          )}

          {selectedRunPlanIsAutomation && (

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

              Plan automation: Playwright chạy ngay khi Start run. Theo dõi tiến độ ở execution workbench bên dưới.

            </div>

          )}

          <Button
            type="submit"
            variant="primary"
            loading={startingRun}
            disabled={
              startingRun
              || Boolean(displayedStartRunError)
              || (Boolean(selectedRunPlan) && getPlanCaseCount(selectedRunPlan) === 0)
            }
          >

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

            <div className="flex flex-wrap items-start gap-4">

              <div className="min-w-0 flex-1">

                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">

                  Execution workbench

                </div>

                <div className="text-xl font-semibold text-slate-900">{selectedRun.name}</div>

                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">

                  <div><span className="font-medium text-slate-500">Project:</span> {selectedRun.project?.name || "-"}</div>

                  <div><span className="font-medium text-slate-500">Version:</span> {selectedRun.version?.name || "-"}</div>

                  <div><span className="font-medium text-slate-500">Plan:</span> {selectedRun.testPlan?.name || "-"}</div>

                  <div><span className="font-medium text-slate-500">Started by:</span> {userName(selectedRun.startedBy)}</div>

                  <div><span className="font-medium text-slate-500">Started at:</span> {startedAtLabel}</div>

                  <div><span className="font-medium text-slate-500">Progress:</span> {runSummary.done}/{runSummary.total} done ({runSummary.progressPercent.toFixed(1)}%)</div>

                </div>

              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">

                <StatusBadge status={String(selectedRun.status || "running")} />

                <StatusBadge status={String(selectedRun.testPlan?.executionMode || "manual")} />

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">

                  {runSummary.done}/{runSummary.total} done

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

          onOpenRun={onOpenRun}

          activeRunId={selectedRun ? getId(selectedRun) : ""}

        />

      ) : null}

    </div>

  );

}

