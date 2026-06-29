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

export interface AutomationStepRecord {
  stepId?: string;
  stepName?: string;
  order?: number;
  action: string;
  targetType?: string;
  target?: string;
  value?: string;
  expected?: string;
  timeoutMs?: number;
}

export interface TestCaseAutomationRecord {
  enabled?: boolean;
  runner?: string;
  webId?: string;
  baseUrl?: string;
  userKey?: string;
  timeoutMs?: number;
  steps?: AutomationStepRecord[];
}

export interface TestCaseRecord {
  _id: string;
  caseKey: string;
  title: string;
  description?: string;
  expected?: string;
  automation?: TestCaseAutomationRecord;
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
  startedBy?: UserRecord | string;
  endedBy?: UserRecord | string;
  testPlan?:
    | string
    | {
        _id: string;
        name?: string;
      };
}

export interface TestRunResultRecord {
  _id: string;
  status: TestStatus | string;
  note?: string;
  notes?: string;
  automationLogs?: string[];
  failureScreenshot?: string;
  failureTrace?: string;
  executedAt?: string;
  testCase?: TestCaseRecord;
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

export interface RunExecutionEntry {
  runId: string;
  runName: string;
  status: TestStatus;
  tester?: UserRecord;
  executedAt?: string;
}

export interface TestCaseInsight {
  testCaseId: string;
  caseKey: string;
  title: string;
  priority: string;
  latestStatus: TestStatus;
  latestRunId?: string;
  latestRunName?: string;
  runExecutionHistory: RunExecutionEntry[];
}

export interface TestPlanDetail {
  testPlanId: string;
  testPlanName: string;
  version: string;
  project: string;
  projectId?: string | null;
  summary: {
    totalTests: number;
    passCount: number;
    failCount: number;
    notRunCount: number;
    passRate: number;
    progress: number;
  };
  runHistory: RunHistory[];
  testCases: TestCaseInsight[];
}

export type DashboardLevel = 'project' | 'version' | 'testplan';
