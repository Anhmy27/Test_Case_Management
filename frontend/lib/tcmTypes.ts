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

// Dashboard Types
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'untested';

export interface ProjectStats {
  _id: string;
  name: string;
  code: string;
  latestVersion: string;
  passRate: number;
  totalTests: number;
  failCount: number;
  lastUpdated: string;
}

export interface VersionStats {
  _id: string;
  name: string;
  project: string;
  totalTestPlans: number;
  totalTests: number;
  passCount: number;
  failCount: number;
  notRunCount: number;
  progress: number;
  passRate: number;
}

export interface TestPlanStats {
  _id: string;
  name: string;
  owner?: UserRecord;
  assignees?: UserRecord[];
  progress: number;
  passRate: number;
  lastRunTime?: string;
  status: string;
}

export interface RunHistory {
  runId: string;
  runName: string;
  passCount: number;
  failCount: number;
  blockedCount: number;
  notRunCount: number;
  executedAt: string;
}

export interface TestCaseInsight {
  testCaseId: string;
  caseKey: string;
  title: string;
  priority: string;
  currentStatus: TestStatus;
  failCount: number;
  executionHistory: TestStatus[];
  lastTester?: UserRecord;
  lastRunTime?: string;
}

export interface TestPlanDetail {
  testPlanId: string;
  testPlanName: string;
  version: string;
  project: string;
  summary: {
    totalTests: number;
    passCount: number;
    failCount: number;
    notRunCount: number;
    passRate: number;
    progress: number;
  };
  runHistory: RunHistory[];
  insights: {
    stillFailing: TestCaseInsight[];
    failedThenPassed: TestCaseInsight[];
    flakyTests: TestCaseInsight[];
    notRun: TestCaseInsight[];
  };
  testCases: TestCaseInsight[];
}

export type DashboardLevel = 'project' | 'version' | 'testplan';
