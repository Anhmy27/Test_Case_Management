export const TEST_CASE_PRIORITY_OPTIONS = [
  { value: "lowest", label: "Lowest" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "highest", label: "Highest" },
] as const;

export type TestCasePriority = (typeof TEST_CASE_PRIORITY_OPTIONS)[number]["value"];

export const TEST_CASE_PRIORITY_VALUES: TestCasePriority[] =
  TEST_CASE_PRIORITY_OPTIONS.map((option) => option.value);

/** Map legacy DB/import values to a form select value. */
export function normalizePriorityForForm(
  priority?: string | null,
): TestCasePriority {
  const normalized = String(priority || "medium").trim().toLowerCase();
  if (normalized === "critical") {
    return "highest";
  }
  if (TEST_CASE_PRIORITY_VALUES.includes(normalized as TestCasePriority)) {
    return normalized as TestCasePriority;
  }
  return "medium";
}

export function formatPriorityLabel(priority?: string | null): string {
  const value = normalizePriorityForForm(priority);
  const option = TEST_CASE_PRIORITY_OPTIONS.find((item) => item.value === value);
  return option?.label ?? value;
}

export function isHighRiskPriority(priority?: string | null): boolean {
  const normalized = String(priority || "").trim().toLowerCase();
  return ["high", "highest", "critical"].includes(normalized);
}
