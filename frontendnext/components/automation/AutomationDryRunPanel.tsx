"use client";

import { useEffect, useState } from "react";
import type { AutomationForm } from "@/lib/automationStepMeta";
import { runAutomationDryRun, type DryRunResult } from "@/lib/automationDryRun";
import { WORKBENCH_HINT_CLS, WORKBENCH_INPUT_CLS, WorkbenchField, WorkbenchSection } from "@/components/workspaceScreens/shared";
import DryRunResultView from "./DryRunResultView";

type Props = {
  automationForm: AutomationForm;
  testCaseId?: string;
};

export default function AutomationDryRunPanel({
  automationForm,
  testCaseId = "",
}: Props) {
  const [baseUrlOverride, setBaseUrlOverride] = useState("");
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<DryRunResult | null>(null);

  useEffect(() => {
    setBaseUrlOverride("");
  }, [testCaseId, automationForm.baseUrl]);

  const handleDryRun = async () => {
    setRunning(true);
    setErrorMessage("");
    setResult(null);

    try {
      const dryRunResult = await runAutomationDryRun({
        automationForm,
        testCaseId,
        baseUrlOverride,
      });
      setResult(dryRunResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Dry run thất bại");
    } finally {
      setRunning(false);
    }
  };

  const effectiveBaseUrl = String(baseUrlOverride || automationForm.baseUrl || "").trim();
  const canRun =
    automationForm.enabled &&
    automationForm.steps.some((step) => String(step.action || "").trim()) &&
    Boolean(effectiveBaseUrl);

  return (
    <WorkbenchSection
      title="Dry run"
      hint="Chạy thử Playwright trước khi lưu test case"
      tone="automation"
      action={
        <button
          type="button"
          disabled={!canRun || running}
          onClick={() => void handleDryRun()}
          className="rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {running ? "Đang chạy..." : "Chạy thử"}
        </button>
      }
    >
      <div className="rounded-lg border border-indigo-100 bg-white p-3 shadow-sm dark:border-indigo-900/50 dark:bg-zinc-900/60">
        <WorkbenchField label="Base URL ghi đè">
          <input
            value={baseUrlOverride}
            onChange={(event) => setBaseUrlOverride(event.target.value)}
            placeholder={automationForm.baseUrl || "https://app.example.com"}
            className={WORKBENCH_INPUT_CLS}
          />
        </WorkbenchField>
        <p className={`${WORKBENCH_HINT_CLS} mt-1.5`}>
          Để trống sẽ dùng URL gốc ở phần Automation phía trên.
        </p>

        {!canRun && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            Cần bật automation, nhập Base URL và thêm ít nhất một bước trước khi chạy thử.
          </div>
        )}

        {errorMessage ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {result ? (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
            <DryRunResultView result={result} />
          </div>
        ) : null}
      </div>
    </WorkbenchSection>
  );
}
