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

type Props = {
  token: string;
  automationForm: AutomationForm;
  testCaseId?: string;
};

export default function AutomationDryRunPanel({
  token,
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
    if (!result || result.status !== "fail" || !hasFailureScreenshot(result.failureScreenshot) || !token) {
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
          token,
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
  }, [result, token]);

  const handleDryRun = async () => {
    setRunning(true);
    setErrorMessage("");
    setResult(null);

    try {
      const dryRunResult = await runAutomationDryRun({
        token,
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
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dry run
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Chạy thử automation của test case hiện tại mà không cần Save hay tạo Test Run.
          </p>
        </div>
        <button
          type="button"
          disabled={!canRun || running || !token}
          onClick={() => void handleDryRun()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Đang chạy..." : "Chạy dry run"}
        </button>
      </div>

      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Base URL (tùy chọn ghi đè)
        <input
          value={baseUrlOverride}
          onChange={(event) => setBaseUrlOverride(event.target.value)}
          placeholder={automationForm.baseUrl || "https://app.example.com"}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {!canRun && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Bật automation, nhập Base URL và ít nhất một step trước khi chạy dry run.
        </div>
      )}

      {errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3">
          <div className={`rounded-lg border px-3 py-2 text-xs ${dryRunStatusClassName(result.status)}`}>
            <div className="font-semibold">
              Kết quả: {dryRunStatusLabel(result.status)} · {formatDryRunDuration(result.durationMs)}
            </div>
            <div className="mt-1 whitespace-pre-line">{result.note}</div>
          </div>

          {Array.isArray(result.logs) && result.logs.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Log từng bước
              </div>
              <ol className="mt-2 space-y-1">
                {result.logs.map((log, index) => (
                  <li
                    key={`${result.dryRunId}-${index}`}
                    className="rounded border border-slate-100 bg-white px-2 py-1.5 text-[11px] text-slate-600"
                  >
                    <span className="mr-1.5 text-slate-400">#{index + 1}</span>
                    {log}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.status === "fail" && hasFailureScreenshot(result.failureScreenshot) ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                Screenshot khi fail
              </div>
              {loadingScreenshot ? (
                <div className="mt-2 text-xs text-rose-800">Đang tải screenshot...</div>
              ) : screenshotError ? (
                <div className="mt-2 text-xs text-rose-800">{screenshotError}</div>
              ) : screenshotSrc ? (
                <img
                  alt="Dry run failure screenshot"
                  className="mt-2 max-h-[480px] w-full rounded-lg border border-rose-200 bg-white object-contain"
                  src={screenshotSrc}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
