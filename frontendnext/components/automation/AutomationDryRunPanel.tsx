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
import { fetchDryRunFailureScreenshot, hasFailureScreenshot, hasFailureTrace, downloadDryRunFailureTrace } from "@/lib/automationArtifacts";
import { WORKBENCH_HINT_CLS, WORKBENCH_INPUT_CLS, WORKBENCH_LABEL_CLS, WORKBENCH_META_CLS, WorkbenchField, WorkbenchSection } from "@/components/workspaceScreens/shared";
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
  const [traceError, setTraceError] = useState("");
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  const [downloadingTrace, setDownloadingTrace] = useState(false);

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
    setTraceError("");

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
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
          <div className={`rounded border px-2 py-0.5 !text-[10px] leading-snug ${dryRunStatusClassName(result.status)}`}>
            <div>
              {dryRunStatusLabel(result.status)} · {formatDryRunDuration(result.durationMs)}
            </div>
            <div className="mt-0.5 whitespace-pre-line text-slate-600">{result.note}</div>
          </div>

          {Array.isArray(result.logs) && result.logs.length > 0 ? (
            <div className="rounded border border-slate-200 bg-white p-1.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Log</div>
              <ol className="mt-1 space-y-0.5">
                {result.logs.map((log, index) => (
                  <li
                    key={`${result.dryRunId}-${index}`}
                    className={`${WORKBENCH_META_CLS} rounded border border-slate-50 px-1.5 py-px text-slate-600`}
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
              <div className="text-[11px] uppercase tracking-wide text-rose-500">Screenshot</div>
              {loadingScreenshot ? (
                <div className={`${WORKBENCH_META_CLS} mt-1 text-rose-700`}>Đang tải...</div>
              ) : screenshotError ? (
                <div className={`${WORKBENCH_META_CLS} mt-1 text-rose-700`}>{screenshotError}</div>
              ) : screenshotSrc ? (
                <ZoomableScreenshot src={screenshotSrc} alt="Dry run failure screenshot" />
              ) : null}
            </div>
          ) : null}

          {result.status === "fail" && hasFailureTrace(result.failureTrace) ? (
            <div className="rounded border border-rose-100 bg-rose-50/50 p-1.5">
              <div className="text-[11px] uppercase tracking-wide text-rose-500">Playwright trace</div>
              <p className={`${WORKBENCH_META_CLS} mt-1 text-rose-800`}>
                Mở bằng: <code className="rounded bg-white px-1">npx playwright show-trace failure.trace.zip</code>
              </p>
              {traceError ? (
                <div className={`${WORKBENCH_META_CLS} mt-1 text-rose-700`}>{traceError}</div>
              ) : null}
              <button
                type="button"
                disabled={downloadingTrace}
                onClick={() => {
                  setTraceError("");
                  setDownloadingTrace(true);
                  void downloadDryRunFailureTrace({ dryRunId: result.dryRunId })
                    .catch((error) => {
                      setTraceError(error instanceof Error ? error.message : "Không tải được trace");
                    })
                    .finally(() => setDownloadingTrace(false));
                }}
                className={`${WORKBENCH_META_CLS} mt-1 rounded border border-rose-200 bg-white px-2 py-0.5 text-rose-800 hover:bg-rose-100 disabled:opacity-60`}
              >
                {downloadingTrace ? "Đang tải trace..." : "Tải trace (.zip)"}
              </button>
            </div>
          ) : null}
          </div>
        ) : null}
      </div>
    </WorkbenchSection>
  );
}
