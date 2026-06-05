import { getId } from "@/lib/api";

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

export function getRunDocumentId(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as RecordAny;
    return String(record._id || record.id || getId(record) || "").trim();
  }

  return "";
}

export function findProjectByReference(projects: RecordAny[], reference: unknown) {
  const referenceId = String(getId(reference) || reference || "").trim();
  if (!referenceId) {
    return null;
  }

  return (
    projects.find((project) => {
      const projectIds = [
        String(project?._id || "").trim(),
        String(project?.entityId || "").trim(),
        String(getId(project) || "").trim(),
      ].filter(Boolean);

      return projectIds.includes(referenceId);
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
