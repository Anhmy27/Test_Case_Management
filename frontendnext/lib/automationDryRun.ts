import type { AutomationForm } from "@/lib/automationStepMeta";
import { apiRequest } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export type DryRunResult = {
  dryRunId: string;
  status: "pass" | "fail" | "blocked" | "skip";
  note: string;
  logs: string[];
  failureScreenshot: string;
  durationMs: number;
  testCase: {
    id: string;
    caseKey: string;
    title: string;
  };
  executedBy: {
    id: string;
    name: string;
    email: string;
  };
};

export function normalizeAutomationStepsForApi(steps: AutomationForm["steps"]) {
  return steps
    .filter((step) => String(step.action || "").trim())
    .map((step, index) => ({
      stepId: String(step.stepId || "").trim() || String(index + 1),
      stepName: String(step.stepName || "").trim(),
      order: index + 1,
      action: String(step.action || "goto").trim(),
      targetType: String(step.targetType || "css"),
      target: String(step.target || ""),
      value: String(step.value || ""),
      expected: String(step.expected || ""),
      timeoutMs: Number(step.timeoutMs || 15) * 1000,
    }));
}

export function buildDryRunPayload({
  automationForm,
  testCaseId = "",
  baseUrlOverride = "",
}: {
  automationForm: AutomationForm;
  testCaseId?: string;
  baseUrlOverride?: string;
}) {
  const resolvedBaseUrl = String(baseUrlOverride || automationForm.baseUrl || "").trim();

  return {
    testCaseId: testCaseId ? String(testCaseId) : "",
    baseUrl: resolvedBaseUrl,
    automation: {
      enabled: true,
      webId: String(automationForm.webId || "").trim(),
      baseUrl: resolvedBaseUrl,
      userKey: String(automationForm.userKey || "").trim(),
      timeoutMs: Number(automationForm.timeoutMs || 30) * 1000,
      steps: normalizeAutomationStepsForApi(automationForm.steps),
    },
  };
}

export async function runAutomationDryRun({
  token,
  automationForm,
  testCaseId = "",
  baseUrlOverride = "",
}: {
  token: string;
  automationForm: AutomationForm;
  testCaseId?: string;
  baseUrlOverride?: string;
}) {
  const payload = buildDryRunPayload({ automationForm, testCaseId, baseUrlOverride });

  if (!payload.baseUrl) {
    throw new Error("Base URL là bắt buộc để chạy dry run");
  }

  if (payload.automation.steps.length === 0) {
    throw new Error("Cần ít nhất một automation step");
  }

  return apiRequest<DryRunResult>("/api/automation/dry-run", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function formatDryRunDuration(durationMs: number) {
  const seconds = Math.max(0, Number(durationMs || 0)) / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function dryRunStatusLabel(status: string) {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "blocked":
      return "Blocked";
    case "skip":
      return "Skip";
    default:
      return status || "Unknown";
  }
}

export function dryRunStatusClassName(status: string) {
  switch (status) {
    case "pass":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "fail":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "blocked":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function dryRunFailureScreenshotPath(dryRunId: string) {
  return `/api/automation/dry-runs/${encodeURIComponent(dryRunId)}/failure-screenshot`;
}

export async function fetchDryRunFailureScreenshot({
  dryRunId,
  token,
}: {
  dryRunId: string;
  token: string;
}) {
  const response = await fetch(`${API_BASE}${dryRunFailureScreenshotPath(dryRunId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Không tải được screenshot";
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        message = payload.message;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
