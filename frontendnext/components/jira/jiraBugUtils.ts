import { collectEntityIds, getId } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordAny = Record<string, any>;

export function getProjectJiraProjectKey(project?: RecordAny | null) {
  return String(
    project?.jiraProjectKey ||
      project?.jiraProductKey ||
      project?.Jiraproduckeys ||
      project?.JiraProductKey ||
      project?.jiraProductKeys ||
      "",
  ).trim();
}

/** Test runs use Mongo `_id` in API routes; versioned entities may also expose `entityId`. */
export function getRunDocumentId(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object" && value !== null) {
    const record = value as RecordAny;
    for (const candidate of [record._id, record.id, record.entityId]) {
      const normalized = String(candidate || "").trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

export function findProjectByReference(projects: RecordAny[], reference: unknown) {
  const referenceIds = collectEntityIds(reference);
  if (typeof reference === "string") {
    const rawReference = String(reference).trim();
    if (rawReference) {
      referenceIds.add(rawReference);
    }
  }

  if (referenceIds.size === 0) {
    return null;
  }

  return (
    projects.find((project) => {
      const projectIds = collectEntityIds(project);
      for (const projectId of projectIds) {
        if (referenceIds.has(projectId)) {
          return true;
        }
      }
      return false;
    }) || null
  );
}

export function buildJiraBugDescription(
  selectedRunValue: RecordAny,
  selectedItemValue: RecordAny,
) {
  const testCase = selectedItemValue?.testCase || {};
  const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
  const overallExpected = String(testCase.expected || "").trim();
  const stepExpected = Array.from(
    new Set(
      steps
        .map((step: RecordAny) => String(step.expected || "").trim())
        .filter(Boolean),
    ),
  );
  const stepLines = steps.flatMap((step: RecordAny, index: number) => {
    const action = String(step.action || "").trim();
    const expected = String(step.expected || "").trim();
    const line = `${index + 1}. ${action || "Step"}`;
    return expected ? [`${line} (expected: ${expected})`] : [line];
  });
  const expectedResult = overallExpected
    || (stepExpected.length > 0 ? stepExpected.join(" | ") : "N/A");

  return [
    `Run: ${selectedRunValue?.name || ""}`,
    `Test case: ${testCase.caseKey || "TC"} - ${testCase.title || "Untitled"}`,
    "",
    "Steps to reproduce:",
    ...(stepLines.length > 0 ? stepLines : ["1. <no manual steps captured>"]),
    "",
    `Expected result: ${expectedResult}`,
    "",
    `Actual result: ${selectedItemValue?.note || ""}`,
  ].join("\n");
}

export function mapPriorityToJira(priority?: string) {
  switch (String(priority || "").toLowerCase()) {
    case "critical":
    case "highest":
      return "1";
    case "high":
      return "2";
    case "medium":
      return "3";
    case "low":
      return "4";
    case "lowest":
      return "5";
    default:
      return "3";
  }
}

export type JiraBugDialogState = {
  projectId: string;
  projectName: string;
  runId: string;
  resultId: string;
  caseKey: string;
  caseTitle: string;
  issueType: string;
  summary: string;
  description: string;
  priority: string;
  assignee: string;
  originalEstimate: string;
  versions: string[];
  labels: string;
  submitting: boolean;
  error: string;
};
