"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ManualRunExecutionPanel, {
  type ExecutionQueueFilter,
} from "../execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "../execution/AutomationRunExecutionPanel";
import TestRunListSection from "./TestRunListSection";
import { Button, Field, INPUT_CLS, scrollToExecutionWorkbench, SectionCard, StatusBadge } from "./shared";
import {
  buildDefaultRunName,
  countPlanAutomationCases,
  getPlanCaseCount,
  isAutomationEnabledTestCase,
  partitionRunItemsByAutomation,
  summarizeRunResults,
  getId,
  userName as formatUserName,
  validateStartRunForm,
} from "@/lib/api";
import { formatVietnamDateTime } from "@/lib/vietnamDateTime";

type RecordAny = Record<string, any>;

const RUN_LIST_EXPANDED_STORAGE_KEY = "tcm:execution:runListExpanded";

const readStoredRunListExpanded = (fallback: boolean) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = sessionStorage.getItem(RUN_LIST_EXPANDED_STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
};

const persistRunListExpanded = (expanded: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(RUN_LIST_EXPANDED_STORAGE_KEY, String(expanded));
};

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };

  setRunForm: (updater: any) => void;

  startRun: (event: React.FormEvent) => Promise<void>;

  startingRun?: boolean;

  scopedPlans: RecordAny[];

  selectedRun: RecordAny | null;

  myItems: RecordAny[];

  selectedItemId: string;

  setSelectedItemId: Dispatch<SetStateAction<string>>;

  selectedItem?: RecordAny;

  notes: Record<string, string>;

  setNotes: Dispatch<SetStateAction<Record<string, string>>>;

  updateResult: (
    resultId: string,
    status: "pass" | "fail" | "blocked" | "skip",
    note: string,
    notes: string,
  ) => Promise<void>;

  endRun: (runId: string) => Promise<void>;

  canEditSelectedRun: boolean;

  canUploadFailureScreenshot?: boolean;

  canEndSelectedRun?: boolean;

  canControlAutomationRun?: boolean;

  cancellingRun?: boolean;

  retryingRun?: boolean;

  onCancelAutomationRun?: () => Promise<void>;

  onRetryFailedAutomation?: () => Promise<void>;

  onLogBug?: (run: RecordAny, result: RecordAny) => void;

  adminRuns?: RecordAny[];

  onOpenRun?: (runId: string) => void;

  userName?: (value: unknown) => string;

  startRunError?: string;

  onNotice?: (message: string, variant?: "success" | "error" | "info") => void;

  onExportRun?: (runId: string, format?: "xlsx" | "csv") => Promise<void>;

  onOpenRunForEdit?: (runId: string) => void;

  runEditMode?: boolean;

  onSaveRunName?: (name: string) => Promise<void>;

  onCancelRunEdit?: () => void;

  savingRunName?: boolean;

  exportingRun?: boolean;

  initialPlanFilter?: string;

  onOpenPlanInsights?: (planId: string) => void;

  onRefreshRunItems?: () => void | Promise<void>;
};

export default function ExecutionScreen(props: Props) {
  const {
    runForm,

    setRunForm,

    startRun,

    startingRun = false,

    scopedPlans,

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

    canUploadFailureScreenshot = false,

    canEndSelectedRun = false,

    canControlAutomationRun = false,

    cancellingRun = false,

    retryingRun = false,

    onCancelAutomationRun,

    onRetryFailedAutomation,

    onLogBug,

    adminRuns,

    onOpenRun,

    userName = formatUserName,

    startRunError = "",

    onNotice,

    onExportRun,

    onOpenRunForEdit,

    runEditMode = false,

    onSaveRunName,

    onCancelRunEdit,

    savingRunName = false,

    exportingRun = false,

    initialPlanFilter = "",

    onOpenPlanInsights,

    onRefreshRunItems,
  } = props;

  const [startFormExpanded, setStartFormExpanded] = useState(
    () => !props.selectedRun,
  );
  const [queueFilter, setQueueFilter] = useState<ExecutionQueueFilter>("all");
  const [runListExpanded, setRunListExpanded] = useState(() =>
    readStoredRunListExpanded(!props.selectedRun),
  );
  const [runNameDraft, setRunNameDraft] = useState("");
  const [runNameSaveError, setRunNameSaveError] = useState("");

  useEffect(() => {
    setRunNameDraft(String(selectedRun?.name || "").trim());
    setRunNameSaveError("");
  }, [selectedRun, runEditMode]);

  useEffect(() => {
    if (selectedRun) {
      setStartFormExpanded(false);
    } else {
      setStartFormExpanded(true);
    }
    setQueueFilter("all");
  }, [selectedRun]);

  const selectedRunId = selectedRun ? getId(selectedRun) : "";

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    scrollToExecutionWorkbench();
  }, [selectedRunId]);

  useEffect(() => {
    if (!runEditMode || !selectedRun) {
      return;
    }
    setStartFormExpanded(false);
    setRunListExpanded(true);
    persistRunListExpanded(true);
    scrollToExecutionWorkbench();
  }, [runEditMode, selectedRun]);

  const handleOpenRun = useCallback(
    (runId: string) => {
      onOpenRun?.(runId);
      scrollToExecutionWorkbench();
    },
    [onOpenRun],
  );

  const handleOpenRunForEdit = useCallback(
    (runId: string) => {
      onOpenRunForEdit?.(runId);
      scrollToExecutionWorkbench();
    },
    [onOpenRunForEdit],
  );

  const toggleRunListExpanded = useCallback(() => {
    setRunListExpanded((prev) => {
      const next = !prev;
      persistRunListExpanded(next);
      return next;
    });
  }, []);

  const handleQueueFilterChange = useCallback(
    (filter: ExecutionQueueFilter) => {
      setQueueFilter(filter);
      document
        .getElementById("execution-queue-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [],
  );

  const handleSaveRunName = async () => {
    if (!onSaveRunName) {
      return;
    }
    const trimmedName = runNameDraft.trim();
    if (!trimmedName) {
      setRunNameSaveError("Run name is required");
      return;
    }
    setRunNameSaveError("");
    try {
      await onSaveRunName(trimmedName);
    } catch (error) {
      setRunNameSaveError(error instanceof Error ? error.message : "Unable to update test run");
    }
  };

  const handleStartNewRun = useCallback(() => {
    if (!selectedRun) return;
    const planId = getId(selectedRun.testPlan) || "";
    const planName = String(selectedRun.testPlan?.name || "");
    const versionName = String(
      selectedRun.version?.name || selectedRun.testPlan?.version?.name || "",
    );
    setRunForm({
      testPlanId: planId,
      name: buildDefaultRunName(planName, versionName),
      baseUrl: runForm.baseUrl || String(selectedRun.automationBaseUrl || ""),
    });
    setStartFormExpanded(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [runForm.baseUrl, selectedRun, setRunForm]);

  const handleOpenPlanInsights = useCallback(() => {
    if (!selectedRun || !onOpenPlanInsights) return;
    const planEntityId = getId(selectedRun.testPlanEntityId);
    const planFromObject =
      selectedRun.testPlan && typeof selectedRun.testPlan === "object"
        ? getId(selectedRun.testPlan)
        : "";
    const planId =
      planEntityId || planFromObject || getId(selectedRun.testPlan) || "";
    if (!planId) return;
    onOpenPlanInsights(planId);
  }, [onOpenPlanInsights, selectedRun]);

  const selectedStartPlan = useMemo(
    () =>
      scopedPlans.find(
        (plan: RecordAny) => getId(plan) === runForm.testPlanId,
      ) || null,
    [runForm.testPlanId, scopedPlans],
  );

  const runSummary = useMemo(() => summarizeRunResults(myItems), [myItems]);
  const { automationItems, manualItems } = useMemo(
    () => partitionRunItemsByAutomation(myItems),
    [myItems],
  );
  const runHasAutomation = automationItems.length > 0;
  const runHasManual = manualItems.length > 0;
  const selectedPlanAutomationCaseCount = useMemo(
    () => countPlanAutomationCases(selectedStartPlan),
    [selectedStartPlan],
  );
  const isRunCompleted = String(selectedRun?.status || "") === "completed";
  const selectedPlanId = selectedRun ? getId(selectedRun.testPlan) || "" : "";
  const progressSegments = useMemo(() => {
    if (runSummary.total <= 0) return [];
    return [
      { label: "Pass", count: runSummary.pass, className: "bg-emerald-500" },
      { label: "Fail", count: runSummary.fail, className: "bg-rose-500" },
      {
        label: "Blocked",
        count: runSummary.blocked,
        className: "bg-amber-500",
      },
      { label: "Skip", count: runSummary.skip, className: "bg-slate-400" },
      {
        label: "Pending",
        count: runSummary.untested,
        className: "bg-slate-200",
      },
    ].filter((segment) => segment.count > 0);
  }, [runSummary]);
  const defaultRunNamePreview = useMemo(
    () =>
      buildDefaultRunName(
        selectedStartPlan?.name || "",
        selectedStartPlan?.version?.name,
      ),
    [selectedStartPlan],
  );
  const liveStartRunError = useMemo(() => {
    if (!runForm.testPlanId || !selectedStartPlan) {
      return "";
    }

    return (
      validateStartRunForm({
        testPlanId: runForm.testPlanId,
        name: runForm.name,
        baseUrl: runForm.baseUrl || "",
        plan: selectedStartPlan,
        existingRuns: adminRuns || [],
        allPlans: scopedPlans,
      }) || ""
    );
  }, [
    adminRuns,
    runForm.baseUrl,
    runForm.name,
    runForm.testPlanId,
    scopedPlans,
    selectedStartPlan,
  ]);
  const displayedStartRunError = startRunError || liveStartRunError;
  const prevLiveStartRunErrorRef = useRef("");

  useEffect(() => {
    if (!onNotice) {
      return;
    }
    if (startRunError) {
      onNotice(startRunError, "error");
      return;
    }
    if (liveStartRunError && !prevLiveStartRunErrorRef.current) {
      onNotice(liveStartRunError, "error");
    }
    prevLiveStartRunErrorRef.current = liveStartRunError;
  }, [liveStartRunError, onNotice, startRunError]);

  const handleEndRun = async () => {
    if (!selectedRun || String(selectedRun.status || "") !== "running") {
      return;
    }

    if (canEditSelectedRun && selectedItemId && selectedItem) {
      const status = String(selectedItem.status || "");

      if (
        ["pass", "fail", "blocked", "skip"].includes(status) &&
        !isAutomationEnabledTestCase(selectedItem.testCase)
      ) {
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

  const canRetryFailedManual =
    !runHasAutomation &&
    isRunCompleted &&
    runSummary.fail > 0 &&
    Boolean(onRetryFailedAutomation);

  const canEndRun =
    Boolean(selectedRun) &&
    String(selectedRun?.status || "") === "running" &&
    canEndSelectedRun;

  const showRunList =
    Array.isArray(adminRuns) && typeof onOpenRun === "function";
  const startedAtLabel = formatVietnamDateTime(selectedRun?.startedAt);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Start Test Run"
        subtitle="Chọn test plan và khởi chạy test run mới"
        actions={
          selectedRun ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => setStartFormExpanded((prev) => !prev)}
            >
              {startFormExpanded ? "▴ Hide form" : "▾ Start another run"}
            </button>
          ) : undefined
        }
      >
        {selectedRun && !startFormExpanded ? (
          <p className="text-sm text-slate-500">
            Execution workbench đang mở bên dưới. Bấm &quot;Start another
            run&quot; để khởi chạy run mới.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={startRun}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Test Plan">
                <select
                  className={INPUT_CLS}
                  value={runForm.testPlanId}
                  onChange={(e) =>
                    setRunForm((prev: any) => ({
                      ...prev,
                      testPlanId: e.target.value,
                    }))
                  }
                  required
                  disabled={startingRun}
                >
                  <option value="">Select plan</option>

                  {scopedPlans.map((plan: RecordAny) => {
                    const totalCases = (plan.items || []).length;
                    const autoCases = countPlanAutomationCases(plan);
                    const manualCases = totalCases - autoCases;
                    return (
                      <option key={getId(plan)} value={getId(plan)}>
                        {plan.name} ({autoCases} auto, {manualCases} manual)
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field label="Run name">
                <input
                  className={INPUT_CLS}
                  value={runForm.name}
                  onChange={(e) =>
                    setRunForm((prev: any) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={defaultRunNamePreview}
                  disabled={startingRun}
                />
              </Field>
            </div>

            {selectedStartPlan && getPlanCaseCount(selectedStartPlan) === 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Selected plan has no test cases. Add cases to the plan before
                starting a run.
              </div>
            ) : null}

            {selectedPlanAutomationCaseCount > 0 ? (
              <Field label="Base URL mặc định (tùy chọn)">
                <input
                  className={INPUT_CLS}
                  value={runForm.baseUrl || ""}
                  onChange={(e) =>
                    setRunForm((prev: any) => ({
                      ...prev,
                      baseUrl: e.target.value,
                    }))
                  }
                  placeholder="https://app.example.com — dùng khi test case chưa có URL riêng"
                  disabled={startingRun}
                />
              </Field>
            ) : null}

            {selectedPlanAutomationCaseCount > 0 ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                Plan có {selectedPlanAutomationCaseCount} case automation: Playwright chạy case đó, phần còn lại làm thủ công. Mỗi case có thể dùng Base URL riêng trong Test Cases; ô trên chỉ là URL mặc định khi case chưa cấu hình.
              </div>
            ) : null}

            {selectedPlanAutomationCaseCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Automation chạy ngay khi Start run. Theo dõi tiến độ ở execution workbench bên dưới.
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              loading={startingRun}
              disabled={
                startingRun ||
                Boolean(displayedStartRunError) ||
                (Boolean(selectedStartPlan) &&
                  getPlanCaseCount(selectedStartPlan) === 0)
              }
            >
              {startingRun
                ? selectedPlanAutomationCaseCount > 0
                  ? "Đang chạy Playwright..."
                  : "Đang start run..."
                : "▶ Start test run"}
            </Button>
          </form>
        )}
      </SectionCard>

      {selectedRun ? (
        <>
          <section
            id="execution-workbench-panel"
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              runEditMode ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Execution workbench
                  </div>
                  {runEditMode ? (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      Edit mode
                    </span>
                  ) : null}
                </div>

                {runEditMode ? (
                  <div className="mt-2 space-y-3">
                    <Field label="Run name">
                      <input
                        className={INPUT_CLS}
                        value={runNameDraft}
                        onChange={(event) => setRunNameDraft(event.target.value)}
                        disabled={savingRunName}
                      />
                    </Field>
                    {runNameSaveError ? (
                      <p className="text-sm text-rose-600">{runNameSaveError}</p>
                    ) : null}
                    <p className="text-sm text-slate-500">
                      {selectedRun.status === "completed"
                        ? "Run đã completed — admin có thể sửa lại Pass/Fail/Blocked/Skip cho từng case bên dưới, rồi bấm Save run để lưu tên."
                        : "Cập nhật tên run và chỉnh kết quả test case bên dưới, rồi bấm Save run."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={savingRunName}
                        onClick={() => void handleSaveRunName()}
                      >
                        Save run
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={savingRunName}
                        onClick={onCancelRunEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xl font-semibold text-slate-900">{selectedRun.name}</div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    {
                      key: "passed" as const,
                      label: "Pass",
                      count: runSummary.pass,
                      activeClass: "bg-emerald-600 text-white",
                      idleClass:
                        "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                    },
                    {
                      key: "failed" as const,
                      label: "Fail",
                      count: runSummary.fail,
                      activeClass: "bg-rose-600 text-white",
                      idleClass:
                        "border-rose-200 text-rose-700 hover:bg-rose-50",
                    },
                    {
                      key: "pending" as const,
                      label: "Pending",
                      count: runSummary.untested,
                      activeClass: "bg-slate-800 text-white",
                      idleClass:
                        "border-slate-200 text-slate-600 hover:bg-slate-50",
                    },
                    {
                      key: "blocked" as const,
                      label: "Blocked",
                      count: runSummary.blocked,
                      activeClass: "bg-amber-600 text-white",
                      idleClass:
                        "border-amber-200 text-amber-700 hover:bg-amber-50",
                    },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        queueFilter === chip.key
                          ? chip.activeClass
                          : chip.idleClass
                      }`}
                      onClick={() => handleQueueFilterChange(chip.key)}
                    >
                      {chip.label} ({chip.count})
                    </button>
                  ))}
                  {queueFilter !== "all" ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      onClick={() => handleQueueFilterChange("all")}
                    >
                      All ({runSummary.total})
                    </button>
                  ) : null}
                </div>

                {progressSegments.length > 0 ? (
                  <div className="mt-3">
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      {progressSegments.map((segment) => (
                        <div
                          key={segment.label}
                          className={`h-full ${segment.className}`}
                          style={{
                            width: `${(segment.count / runSummary.total) * 100}%`,
                          }}
                          title={`${segment.label}: ${segment.count}`}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      {progressSegments.map((segment) => (
                        <span key={segment.label}>
                          {segment.label} {segment.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <span className="font-medium text-slate-500">Project:</span>{" "}
                    {selectedRun.project?.name || "-"}
                  </div>

                  <div>
                    <span className="font-medium text-slate-500">Version:</span>{" "}
                    {selectedRun.version?.name || "-"}
                  </div>

                  <div>
                    <span className="font-medium text-slate-500">Plan:</span>{" "}
                    {selectedRun.testPlan?.name || "-"}
                  </div>

                  <div>
                    <span className="font-medium text-slate-500">
                      Started by:
                    </span>{" "}
                    {userName(selectedRun.startedBy)}
                  </div>

                  <div>
                    <span className="font-medium text-slate-500">
                      Started at:
                    </span>{" "}
                    {startedAtLabel}
                  </div>

                  <div>
                    <span className="font-medium text-slate-500">
                      Progress:
                    </span>{" "}
                    {runSummary.done}/{runSummary.total} done (
                    {runSummary.progress.toFixed(1)}%)
                  </div>
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <StatusBadge status={String(selectedRun.status || "running")} />

                {runHasAutomation ? (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Auto {automationItems.length}
                  </span>
                ) : null}
                {runHasManual ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Manual {manualItems.length}
                  </span>
                ) : null}

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {runSummary.done}/{runSummary.total} done
                </span>

                {onOpenPlanInsights && selectedPlanId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleOpenPlanInsights}
                  >
                    View insights
                  </Button>
                ) : null}

                {isRunCompleted ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleStartNewRun}
                  >
                    Start new run
                  </Button>
                ) : null}

                {canRetryFailedManual ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={retryingRun}
                    onClick={() => void onRetryFailedAutomation?.()}
                  >
                    {retryingRun
                      ? "Retrying..."
                      : `Retry ${runSummary.fail} fail`}
                  </Button>
                ) : null}

                {onExportRun && getId(selectedRun) ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={exportingRun}
                      onClick={() =>
                        void onExportRun(getId(selectedRun), "xlsx")
                      }
                    >
                      Export XLSX
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={exportingRun}
                      onClick={() =>
                        void onExportRun(getId(selectedRun), "csv")
                      }
                    >
                      Export CSV
                    </Button>
                  </>
                ) : null}

                {canEndRun ? (
                  <Button size="sm" variant="primary" onClick={() => void handleEndRun()}>
                    End run
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto">
            {runHasAutomation ? (
              <AutomationRunExecutionPanel
                selectedRun={selectedRun}
                myItems={automationItems}
                selectedItemId={selectedItemId}
                setSelectedItemId={setSelectedItemId}
                selectedItem={selectedItem}
                notes={notes}
                canControlRun={canControlAutomationRun}
                cancellingRun={cancellingRun}
                retryingRun={retryingRun}
                onCancelRun={onCancelAutomationRun}
                onRetryFailed={onRetryFailedAutomation}
                onLogBug={onLogBug}
                queueFilter={queueFilter}
                onQueueFilterChange={handleQueueFilterChange}
              />
            ) : null}

            {runHasManual ? (
              <ManualRunExecutionPanel
                selectedRun={selectedRun}
                myItems={manualItems}
                selectedItemId={selectedItemId}
                setSelectedItemId={setSelectedItemId}
                selectedItem={selectedItem}
                notes={notes}
                setNotes={setNotes}
                onUpdateResult={updateResult}
                onEndRun={handleEndRun}
                canEditRun={canEditSelectedRun}
                canUploadFailureScreenshot={canUploadFailureScreenshot}
                canEndRun={canEndRun}
                onLogBug={onLogBug}
                queueFilter={queueFilter}
                onQueueFilterChange={handleQueueFilterChange}
                onScreenshotUploaded={onRefreshRunItems}
                onExportRun={onExportRun}
                onOpenPlanInsights={
                  onOpenPlanInsights && selectedPlanId
                    ? handleOpenPlanInsights
                    : undefined
                }
              />
            ) : null}
          </div>
        </>
      ) : showRunList ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Chọn một run trong danh sách bên dưới hoặc start run mới để mở
          execution workbench.
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Select a plan and start a run to enter the execution workbench.
        </div>
      )}

      {showRunList ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900"
              onClick={toggleRunListExpanded}
            >
              {runListExpanded
                ? `▴ Hide test runs (${adminRuns?.length ?? 0})`
                : `▾ Show test runs (${adminRuns?.length ?? 0})`}
            </button>
          </section>
          {runListExpanded ? (
            <TestRunListSection
              runs={adminRuns}
              scopedPlans={scopedPlans}
              userName={userName}
              onOpenRun={handleOpenRun}
              onOpenRunForEdit={onOpenRunForEdit ? handleOpenRunForEdit : undefined}
              onExportRun={onExportRun}
              activeRunId={selectedRun ? getId(selectedRun) : ""}
              initialPlanFilter={initialPlanFilter}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
