import { apiRequest, getId } from "@/lib/api";
import type { DryRunResult } from "@/lib/automationDryRun";
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
  errorMessage?: string;
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

/** Test case option for merge / extension — id is canonical entityId via getId(). */
export type RecordingTargetTestCase = {
  id: string;
  label: string;
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  accepted: "Giữ",
  rejected: "Bỏ",
  edited: "Đã sửa",
};

function formatTestCaseOptionLabel(testCase: Record<string, unknown>, id: string) {
  const caseKey = String(testCase.caseKey || testCase.key || "").trim();
  const title = String(testCase.title || testCase.name || "").trim();
  if (caseKey && title) {
    return `${caseKey} — ${title}`;
  }
  return caseKey || title || id;
}

export async function listRecordingTargetTestCases(projectId: string): Promise<RecordingTargetTestCase[]> {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return [];
  }

  const response = await apiRequest<{ testCases?: Array<Record<string, unknown>> }>(
    `/api/test-cases?projectId=${encodeURIComponent(normalizedProjectId)}`,
  );

  return (response.testCases || [])
    .map((testCase) => {
      const id = getId(testCase);
      if (!id) {
        return null;
      }
      return {
        id,
        label: formatTestCaseOptionLabel(testCase, id),
      };
    })
    .filter((item): item is RecordingTargetTestCase => Boolean(item));
}

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

/** One draft step edit — only include fields the user actually changed (see recordingDraftPatchService). */
export type RecordingDraftStepPatch = {
  draftStepId: string;
  value?: string;
  expected?: string;
  chosenLocatorIndex?: number;
  reviewStatus?: string;
};

/** PATCH nháp — chỉ cho phép khi session còn `ready_for_review` (SR-4.5). */
export async function patchRecordingDraft(sessionId: string, patches: RecordingDraftStepPatch[]) {
  const normalizedId = String(sessionId || "").trim();
  if (!normalizedId) {
    throw new Error("Session ID là bắt buộc");
  }
  if (!patches.length) {
    throw new Error("Chưa có thay đổi nào để lưu");
  }

  const response = await apiRequest<{ session: RecordingSession }>(
    `/api/recording/sessions/${encodeURIComponent(normalizedId)}/draft`,
    undefined,
    { method: "PATCH", body: JSON.stringify({ draftSteps: patches }) },
  );

  if (!response.session?.id) {
    throw new Error("Không lưu được thay đổi nháp");
  }

  return response.session;
}

/** Chèn 1 bước nháp thủ công (bất kỳ action nào) — insertAfterDraftStepId rỗng = thêm cuối danh sách. */
export type InsertDraftStepInput = {
  insertAfterDraftStepId?: string;
  inferredAction: string;
  targetType?: string;
  target?: string;
  value?: string;
  expected?: string;
};

export async function insertRecordingDraftStep(sessionId: string, input: InsertDraftStepInput) {
  const normalizedId = String(sessionId || "").trim();
  if (!normalizedId) {
    throw new Error("Session ID là bắt buộc");
  }

  const response = await apiRequest<{ session: RecordingSession }>(
    `/api/recording/sessions/${encodeURIComponent(normalizedId)}/draft/steps`,
    undefined,
    { method: "POST", body: JSON.stringify(input) },
  );

  if (!response.session?.id) {
    throw new Error("Không thêm được bước nháp");
  }

  return response.session;
}

/** Preview result — dry-run fields + session context (SR-4.6). */
export type RecordingPreviewResult = DryRunResult & {
  sessionId: string;
  projectId: string;
  previewStepsCount: number;
  baseUrl: string;
};

/** Merge API response — FE chỉ dùng `mergedStepsCount` rồi reload session (SR-4.6). */
export type RecordingMergeResult = {
  session: {
    id: string;
    status: string;
    mergedAt: string | null;
    mergedTestCaseEntityId: string;
    mergedTestCaseVersionId: string;
  };
  testCase: {
    id: string;
    entityId: string;
    versionNumber: number;
  };
  mergedStepsCount: number;
};

/** Xem thử (dry run) từ draft session — chưa ghi vào test case (SR-4.6). */
export async function previewRecordingSession(
  sessionId: string,
  { baseUrl = "", webId = "", userKey = "" }: { baseUrl?: string; webId?: string; userKey?: string } = {},
) {
  const normalizedId = String(sessionId || "").trim();
  if (!normalizedId) {
    throw new Error("Session ID là bắt buộc");
  }

  const payload: Record<string, string> = {};
  if (baseUrl.trim()) payload.baseUrl = baseUrl.trim();
  if (webId.trim()) payload.webId = webId.trim();
  if (userKey.trim()) payload.userKey = userKey.trim();

  const response = await apiRequest<{ preview: RecordingPreviewResult }>(
    `/api/recording/sessions/${encodeURIComponent(normalizedId)}/preview`,
    undefined,
    { method: "POST", body: JSON.stringify(payload) },
  );

  if (!response.preview?.dryRunId) {
    throw new Error("Không xem thử được recording session");
  }

  return response.preview;
}

/** Lưu nháp vào test case (merge) — tạo version mới, đóng SR-4 (SR-4.6). */
export async function mergeRecordingSession(sessionId: string, testCaseId: string = "") {
  const normalizedId = String(sessionId || "").trim();
  if (!normalizedId) {
    throw new Error("Session ID là bắt buộc");
  }

  const trimmedTestCaseId = String(testCaseId || "").trim();
  const payload = trimmedTestCaseId ? { testCaseId: trimmedTestCaseId } : {};

  const response = await apiRequest<RecordingMergeResult>(
    `/api/recording/sessions/${encodeURIComponent(normalizedId)}/merge`,
    undefined,
    { method: "POST", body: JSON.stringify(payload) },
  );

  if (!response.session?.id) {
    throw new Error("Không lưu được vào test case");
  }

  return response;
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

export function sortRecordingDraftSteps(steps: RecordingDraftStep[] = []) {
  return [...steps].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

export type DraftStepListItem =
  | { kind: "group"; blockId: string; title: string }
  | { kind: "step"; step: RecordingDraftStep };

const KNOWN_INTENT_LABELS = new Set(["Đăng nhập", "Tìm kiếm", "Upload file"]);

function truncateDisplayText(value: string, maxLength = 48) {
  const trimmed = String(value || "").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function shortenPageUrl(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return path ? `${parsed.host}${path}` : parsed.host;
  } catch {
    return truncateDisplayText(trimmed, 56);
  }
}

function stepLabelHint(step: RecordingDraftStep) {
  return truncateDisplayText(String(step.target || step.value || "").trim());
}

/** Tester-facing title for one intent group — prefers action text over raw URL path labels. */
export function formatDraftStepGroupTitle(
  steps: RecordingDraftStep[] = [],
  blockLabel = "",
): string {
  const label = String(blockLabel || "").trim();
  if (KNOWN_INTENT_LABELS.has(label) || label.startsWith("Upload")) {
    return label;
  }

  if (!steps.length) {
    return label || "Nhóm thao tác";
  }

  const first = steps[0];
  const action = String(first.inferredAction || "").trim().toLowerCase();

  if (action === "goto" || action === "navigate") {
    const page = shortenPageUrl(String(first.value || first.target || ""));
    return page ? `Vào trang ${page}` : "Vào trang";
  }

  if (steps.length === 1) {
    const hint = stepLabelHint(first);
    if (action === "click") {
      return hint ? `Click “${hint}”` : "Click";
    }
    if (action === "hover") {
      return hint ? `Di chuột vào “${hint}”` : "Di chuột vào phần tử";
    }
    if (action === "type" || action === "fill") {
      return hint ? `Điền “${hint}”` : "Điền ô nhập";
    }
    if (action === "select") {
      return hint ? `Chọn “${hint}”` : "Chọn dropdown";
    }
    if (action === "upload") {
      return "Upload file";
    }
    return first.inferredAction || "Thao tác";
  }

  const actions = steps.map((step) => String(step.inferredAction || "").trim().toLowerCase());
  if (actions.every((item) => item === "click")) {
    return `Các thao tác click (${steps.length} bước)`;
  }

  const head = formatDraftStepGroupTitle([first], "");
  return `${head} · ${steps.length} bước`;
}

/** Insert group headers before the first draft step of each intent block (for inline list UI). */
export function buildDraftStepListWithGroups(
  draftSteps: RecordingDraftStep[] = [],
  intentBlocks: RecordingIntentBlock[] = [],
): DraftStepListItem[] {
  const stepById = new Map(draftSteps.map((step) => [step.draftStepId, step]));
  const groupByFirstStepId = new Map<string, { blockId: string; title: string }>();

  for (const block of intentBlocks) {
    const stepIds = Array.isArray(block.draftStepIds) ? block.draftStepIds : [];
    const firstStepId = stepIds[0];
    if (!firstStepId || groupByFirstStepId.has(firstStepId)) {
      continue;
    }
    const stepsInBlock = stepIds
      .map((stepId) => stepById.get(stepId))
      .filter((step): step is RecordingDraftStep => Boolean(step));
    groupByFirstStepId.set(firstStepId, {
      blockId: block.blockId || firstStepId,
      title: formatDraftStepGroupTitle(stepsInBlock, block.label || ""),
    });
  }

  const items: DraftStepListItem[] = [];
  for (const step of draftSteps) {
    const group = groupByFirstStepId.get(step.draftStepId);
    if (group) {
      items.push({ kind: "group", blockId: group.blockId, title: group.title });
    }
    items.push({ kind: "step", step });
  }
  return items;
}
