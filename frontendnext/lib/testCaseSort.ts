type TestCaseKeySource = {
  caseKey?: string | null;
  key?: string | null;
  testCase?: {
    caseKey?: string | null;
    key?: string | null;
  } | null;
};

export function getTestCaseKeyValue(item: TestCaseKeySource): string {
  return String(
    item.testCase?.caseKey ||
      item.testCase?.key ||
      item.caseKey ||
      item.key ||
      "",
  );
}

export function compareTestCaseKeys(
  left: TestCaseKeySource,
  right: TestCaseKeySource,
): number {
  return getTestCaseKeyValue(left).localeCompare(getTestCaseKeyValue(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortByTestCaseKey<T extends TestCaseKeySource>(items: T[]): T[] {
  return [...items].sort(compareTestCaseKeys);
}
