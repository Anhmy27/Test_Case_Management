const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const CSRF_COOKIE = "tcm_csrf";
const CSRF_HEADER = "X-CSRF-Token";

function readBrowserCookie(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function runResultFailureScreenshotPath(runId: string, resultId: string) {
  return `/api/test-runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}/failure-screenshot`;
}

export function dryRunFailureScreenshotPath(dryRunId: string) {
  return `/api/automation/dry-runs/${encodeURIComponent(dryRunId)}/failure-screenshot`;
}

export function hasFailureScreenshot(failureScreenshot?: string | null) {
  return Boolean(String(failureScreenshot || "").trim());
}

async function fetchAuthenticatedScreenshot(path: string) {
  const headers: Record<string, string> = {};
  const csrfToken = readBrowserCookie(CSRF_COOKIE);
  if (csrfToken) {
    headers[CSRF_HEADER] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    credentials: "include",
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

export async function fetchRunResultFailureScreenshot({
  runId,
  resultId,
}: {
  runId: string;
  resultId: string;
}) {
  return fetchAuthenticatedScreenshot(runResultFailureScreenshotPath(runId, resultId));
}

export async function fetchDryRunFailureScreenshot({
  dryRunId,
}: {
  dryRunId: string;
}) {
  return fetchAuthenticatedScreenshot(dryRunFailureScreenshotPath(dryRunId));
}

export async function uploadRunResultFailureScreenshot({
  runId,
  resultId,
  file,
}: {
  runId: string;
  resultId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const csrfToken = readBrowserCookie(CSRF_COOKIE);
  if (csrfToken) {
    headers[CSRF_HEADER] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${runResultFailureScreenshotPath(runId, resultId)}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Không upload được screenshot";
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

  return response.json() as Promise<{ failureScreenshot?: string }>;
}
