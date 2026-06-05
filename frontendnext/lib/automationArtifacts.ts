const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export function runResultFailureScreenshotPath(runId: string, resultId: string) {
  return `/api/test-runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}/failure-screenshot`;
}

export function dryRunFailureScreenshotPath(dryRunId: string) {
  return `/api/automation/dry-runs/${encodeURIComponent(dryRunId)}/failure-screenshot`;
}

export function hasFailureScreenshot(failureScreenshot?: string | null) {
  return Boolean(String(failureScreenshot || "").trim());
}

async function fetchAuthenticatedScreenshot(path: string, token: string) {
  const response = await fetch(`${API_BASE}${path}`, {
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

export async function fetchRunResultFailureScreenshot({
  runId,
  resultId,
  token,
}: {
  runId: string;
  resultId: string;
  token: string;
}) {
  return fetchAuthenticatedScreenshot(runResultFailureScreenshotPath(runId, resultId), token);
}

export async function fetchDryRunFailureScreenshot({
  dryRunId,
  token,
}: {
  dryRunId: string;
  token: string;
}) {
  return fetchAuthenticatedScreenshot(dryRunFailureScreenshotPath(dryRunId), token);
}
