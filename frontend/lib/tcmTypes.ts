export type RecordAny = Record<string, unknown>;

export type TabKey = "overview" | "admin" | "execution" | "dashboard";

export interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
}

export interface ProjectRecord {
  _id: string;
  name: string;
  code: string;
  description?: string;
}

export interface VersionRecord {
  _id: string;
  name: string;
  project: string | ProjectRecord;
}

export interface TestCaseRecord {
  _id: string;
  caseKey: string;
  title: string;
  project: string | ProjectRecord;
}

export interface TestPlanItemRecord {
  _id: string;
  testCase?: TestCaseRecord;
  owner?: UserRecord | string;
  assignees?: Array<UserRecord | string>;
}

export interface TestPlanRecord {
  _id: string;
  name: string;
  items?: TestPlanItemRecord[];
}

export interface TestRunRecord {
  _id: string;
  name: string;
  status: string;
}

export interface DashboardSummary {
  totalRuns: number;
  runningRuns: number;
  totalCases: number;
  executed: number;
  pass: number;
  fail: number;
  blocked: number;
  untested: number;
  passRate: number;
  completionRate: number;
}

export interface DashboardRecord {
  summary: DashboardSummary;
}
