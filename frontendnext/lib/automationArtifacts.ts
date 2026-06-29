import { getCsrfTokenForRequest } from "./csrfToken";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const CSRF_HEADER = "X-CSRF-Token";

export function runResultFailureScreenshotPath(runId: string, resultId: string) {
  return `/api/test-runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}/failure-screenshot`;
}

export function dryRunFailureScreenshotPath(dryRunId: string) {
  return `/api/automation/dry-runs/${encodeURIComponent(dryRunId)}/failure-screenshot`;
}

export function runResultFailureTracePath(runId: string, resultId: string) {
  return `/api/test-runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}/failure-trace`;
}

export function dryRunFailureTracePath(dryRunId: string) {
  return `/api/automation/dry-runs/${encodeURIComponent(dryRunId)}/failure-trace`;
}

export function hasFailureScreenshot(failureScreenshot?: string | null) {
  return Boolean(String(failureScreenshot || "").trim());
}

export function hasFailureTrace(failureTrace?: string | null) {
  return Boolean(String(failureTrace || "").trim());
}

async function fetchAuthenticatedBlob(path: string, fallbackErrorMessage = "Không tải được file") {
  const headers: Record<string, string> = {};
  const csrfToken = getCsrfTokenForRequest();
  if (csrfToken) {
    headers[CSRF_HEADER] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let message = fallbackErrorMessage;
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
  return blob;
}

async function fetchAuthenticatedScreenshot(path: string) {
  const blob = await fetchAuthenticatedBlob(path, "Không tải được screenshot");
  return URL.createObjectURL(blob);
}

async function downloadAuthenticatedArtifact(path: string, filename: string) {
  const blob = await fetchAuthenticatedBlob(path, "Không tải được file");
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
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

export async function downloadRunResultFailureTrace({
  runId,
  resultId,
  filename = "failure.trace.zip",
}: {
  runId: string;
  resultId: string;
  filename?: string;
}) {
  await downloadAuthenticatedArtifact(runResultFailureTracePath(runId, resultId), filename);
}

export async function downloadDryRunFailureTrace({
  dryRunId,
  filename = "failure.trace.zip",
}: {
  dryRunId: string;
  filename?: string;
}) {
  await downloadAuthenticatedArtifact(dryRunFailureTracePath(dryRunId), filename);
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
  const csrfToken = getCsrfTokenForRequest();
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
