import { apiRequest } from "@/lib/api";
import { TARGET_TYPE_LABELS } from "@/lib/automationStepMeta";

export type RecordingLocatorCandidate = {
  strategy: string;
  value: string;
  roleName?: string;
  score?: number;
  uniqueOnPage?: boolean;
};

export type RecordingDraftStep = {
  draftStepId: string;
  order: number;
  inferredAction: string;
  targetType: string;
  target: string;
  value: string;
  expected: string;
  locatorCandidates: RecordingLocatorCandidate[];
  chosenLocatorIndex: number;
  reviewStatus: "pending" | "accepted" | "rejected" | "edited" | string;
  screenshotKey?: string;
  autoWaitSuggestion?: string;
  sourceSemanticId?: string;
};

export type RecordingIntentBlock = {
  blockId: string;
  label: string;
  draftStepIds: string[];
};

export type RecordingSession = {
  id: string;
  projectId: string;
  testCaseEntityId: string;
  baseUrl: string;
  status: string;
  eventCount: number;
  eventsExternalized: boolean;
  startedAt?: string;
  stoppedAt?: string;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  draftSteps: RecordingDraftStep[];
  intentBlocks: RecordingIntentBlock[];
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  accepted: "Giữ",
  rejected: "Bỏ",
  edited: "Đã sửa",
};

export async function fetchRecordingSession(sessionId: string) {
  const normalizedId = String(sessionId || "").trim();
  if (!normalizedId) {
    throw new Error("Session ID là bắt buộc");
  }

  const response = await apiRequest<{ session: RecordingSession }>(
    `/api/recording/sessions/${encodeURIComponent(normalizedId)}`,
  );

  if (!response.session?.id) {
    throw new Error("Không tìm thấy recording session");
  }

  return response.session;
}

export function formatRecordingReviewStatus(status: string) {
  const normalized = String(status || "").trim();
  return REVIEW_STATUS_LABELS[normalized] || normalized || "—";
}

export function recordingReviewStatusClassName(status: string) {
  switch (String(status || "").trim()) {
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200";
    case "edited":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
  }
}

export function formatRecordingSessionStatus(status: string) {
  return String(status || "—").replace(/_/g, " ");
}

export function formatLocatorCandidate(candidate: RecordingLocatorCandidate) {
  const strategy = String(candidate.strategy || "").trim();
  const strategyLabel = TARGET_TYPE_LABELS[strategy] || strategy || "—";
  const value = String(candidate.value || "").trim();
  const roleName = String(candidate.roleName || "").trim();

  if (strategy === "role" && roleName) {
    return `${strategyLabel}: ${value || "element"} · "${roleName}"`;
  }

  return value ? `${strategyLabel}: ${value}` : strategyLabel;
}

export function getChosenLocatorCandidate(step: RecordingDraftStep) {
  const candidates = Array.isArray(step.locatorCandidates) ? step.locatorCandidates : [];
  if (candidates.length === 0) {
    return null;
  }

  const index = Number.isInteger(step.chosenLocatorIndex) ? step.chosenLocatorIndex : 0;
  return candidates[index] || candidates[0] || null;
}

export function sortRecordingDraftSteps(steps: RecordingDraftStep[] = []) {
  return [...steps].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}
