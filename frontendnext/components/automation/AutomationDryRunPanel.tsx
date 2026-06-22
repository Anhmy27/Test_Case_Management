"use client";

import { useEffect, useState } from "react";
import type { AutomationForm } from "@/lib/automationStepMeta";
import {
  dryRunStatusClassName,
  dryRunStatusLabel,
  formatDryRunDuration,
  runAutomationDryRun,
  type DryRunResult,
} from "@/lib/automationDryRun";
import { fetchDryRunFailureScreenshot, hasFailureScreenshot } from "@/lib/automationArtifacts";
import { WORKBENCH_INPUT_CLS, WorkbenchSection } from "@/components/workspaceScreens/shared";
import ZoomableScreenshot from "../execution/ZoomableScreenshot";

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
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState("");
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

  useEffect(() => {
    setBaseUrlOverride("");
  }, [testCaseId, automationForm.baseUrl]);

  useEffect(() => {
    if (!result || result.status !== "fail" || !hasFailureScreenshot(result.failureScreenshot)) {
      setScreenshotSrc(null);
      setScreenshotError("");
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadScreenshot = async () => {
      setLoadingScreenshot(true);
      setScreenshotError("");

      try {
        const nextObjectUrl = await fetchDryRunFailureScreenshot({
          dryRunId: result.dryRunId,
        });
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        objectUrl = nextObjectUrl;
        setScreenshotSrc(nextObjectUrl);
      } catch (error) {
        if (!cancelled) {
          setScreenshotSrc(null);
          setScreenshotError(error instanceof Error ? error.message : "Không tải được screenshot");
        }
      } finally {
        if (!cancelled) {
          setLoadingScreenshot(false);
        }
      }
    };

    void loadScreenshot();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [result]);

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
      hint="Chạy thử không cần Save"
      action={
        <button
          type="button"
          disabled={!canRun || running}
          onClick={() => void handleDryRun()}
          className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Đang chạy..." : "Chạy"}
        </button>
      }
    >
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400">Base URL ghi đè (tùy chọn)</span>
        <input
          value={baseUrlOverride}
          onChange={(event) => setBaseUrlOverride(event.target.value)}
          placeholder={automationForm.baseUrl || "https://app.example.com"}
          className={WORKBENCH_INPUT_CLS}
        />
      </label>

      {!canRun && (
        <div className="mt-1.5 rounded border border-amber-100 bg-amber-50/80 px-2 py-1 text-[10px] text-amber-800">
          Cần bật automation, Base URL và ít nhất một bước.
        </div>
      )}

      {errorMessage ? (
        <div className="mt-1.5 rounded border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="mt-1.5 space-y-2">
          <div className={`rounded border px-2 py-1 text-[10px] ${dryRunStatusClassName(result.status)}`}>
            <div>
              {dryRunStatusLabel(result.status)} · {formatDryRunDuration(result.durationMs)}
            </div>
            <div className="mt-0.5 whitespace-pre-line text-slate-600">{result.note}</div>
          </div>

          {Array.isArray(result.logs) && result.logs.length > 0 ? (
            <div className="rounded border border-slate-200 bg-white p-1.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Log</div>
              <ol className="mt-1 space-y-0.5">
                {result.logs.map((log, index) => (
                  <li
                    key={`${result.dryRunId}-${index}`}
                    className="rounded border border-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
                    <span className="mr-1 text-slate-300">#{index + 1}</span>
                    {log}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.status === "fail" && hasFailureScreenshot(result.failureScreenshot) ? (
            <div className="rounded border border-rose-100 bg-rose-50/50 p-1.5">
              <div className="text-[9px] uppercase tracking-wide text-rose-500">Screenshot</div>
              {loadingScreenshot ? (
                <div className="mt-1 text-[10px] text-rose-700">Đang tải...</div>
              ) : screenshotError ? (
                <div className="mt-1 text-[10px] text-rose-700">{screenshotError}</div>
              ) : screenshotSrc ? (
                <ZoomableScreenshot src={screenshotSrc} alt="Dry run failure screenshot" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </WorkbenchSection>
  );
}
