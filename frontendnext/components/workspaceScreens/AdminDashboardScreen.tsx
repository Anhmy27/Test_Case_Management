"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from "react";
import StatusBreakdownDonut from "@/components/dashboard/StatusBreakdownDonut";
import ExecutionTrendLineChart from "@/components/dashboard/ExecutionTrendLineChart";
import { buildExecutionTrendPoints } from "@/components/dashboard/buildExecutionTrend";
import ScopeCompareBarChart, {
  type ScopeCompareItem,
} from "@/components/dashboard/ScopeCompareBarChart";
import TopFailingCasesChart, {
  type TopFailingCaseItem,
} from "@/components/dashboard/TopFailingCasesChart";
import DashboardKpiRow, { type DashboardKpiItem } from "@/components/dashboard/DashboardKpiRow";
import DashboardActionCenter, {
  type ActionCenterDelayedPlan,
  type ActionCenterRunItem,
} from "@/components/dashboard/DashboardActionCenter";
import type { DashboardNavigateOptions } from "@/components/workspaceScreens/AdminDashboardRoute";

type RecordAny = Record<string, any>;

type AdminDashboardScreenProps = {
  isGlobalScope: boolean;
  scopedProjectName?: string;
  runningRunsCount: number;
  dashboardSummary: RecordAny;
  dashboardData: RecordAny;
  testRuns: RecordAny[];
  versionHealth: RecordAny[];
  projectOverview: RecordAny[];
  projects: RecordAny[];
  plans: RecordAny[];
  selectedProjectId?: string;
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  getId: (value: unknown) => string;
  onNavigate?: (tab: string, options?: string | DashboardNavigateOptions) => void;
};

type MappedRunningRun = {
  run: RecordAny;
  projectName: string;
  projectId: string;
  actionItem: ActionCenterRunItem;
};

function buildDashboardKpis({
  isGlobalScope,
  passRate,
  completionRate,
  runningRunsCount,
  atRiskCount,
  blockedCount,
}: {
  isGlobalScope: boolean;
  passRate: number;
  completionRate: number;
  runningRunsCount: number;
  atRiskCount: number;
  blockedCount: number;
}): DashboardKpiItem[] {
  return [
    {
      id: "pass-rate",
      label: "Pass Rate",
      value: `${passRate}%`,
      helper: "Across executed results in scope",
      hint: "pass / (pass + fail + blocked)",
      accent: "emerald" as const,
    },
    {
      id: "completion",
      label: "Completion",
      value: `${completionRate}%`,
      helper: "Share of planned results executed",
      hint: "(pass + fail + blocked) / total results in runs",
      accent: "indigo" as const,
    },
    {
      id: "running-runs",
      label: "Running Runs",
      value: runningRunsCount,
      helper: "Test runs currently in progress",
      accent: "sky" as const,
    },
    isGlobalScope
      ? {
          id: "at-risk",
          label: "At Risk",
          value: atRiskCount,
          helper: "Delayed plans + high-failure cases",
          hint: "Count of delayed plans and top failing cases in scope",
          accent: "rose" as const,
        }
      : {
          id: "blocked",
          label: "Blocked",
          value: blockedCount,
          helper: "Results blocked during execution",
          hint: "Blocked results across runs in this project",
          accent: "amber" as const,
        },
  ];
}

function resolveRunVersionName(
  run: RecordAny,
  plans: RecordAny[],
  versionHealth: RecordAny[],
  getId: (value: unknown) => string,
): string {
  const versionObj = run.version;
  if (versionObj && typeof versionObj === "object" && versionObj.name) {
    return String(versionObj.name);
  }

  const versionId = getId(versionObj);
  if (versionId) {
    const matchedVersion = versionHealth.find((version) => getId(version) === versionId);
    if (matchedVersion?.name) {
      return String(matchedVersion.name);
    }
  }

  const planId = getId(run.testPlan);
  if (planId) {
    const matchedPlan = plans.find((plan) => getId(plan) === planId);
    if (matchedPlan?.version?.name) {
      return String(matchedPlan.version.name);
    }
  }

  return "—";
}

export default function AdminDashboardScreen({
  isGlobalScope,
  scopedProjectName,
  runningRunsCount,
  dashboardSummary,
  dashboardData,
  testRuns,
  versionHealth,
  projectOverview,
  projects,
  plans,
  selectedProjectId,
  matchesSearch,
  userName,
  getId,
  onNavigate,
}: AdminDashboardScreenProps) {
  const runningRuns = dashboardData.runningTestRuns || [];
  const delayedPlans = dashboardData.delayedTestPlans || [];
  const mostFailedCases = dashboardData.mostFailedTestCases || [];
  const completionRate = dashboardSummary.completionRate || 0;
  const passRate = dashboardSummary.passRate || 0;
  const passCount = Number(dashboardSummary.pass || 0);
  const failCount = Number(dashboardSummary.fail || 0);
  const blockedCount = Number(dashboardSummary.blocked || 0);
  const untestedCount = Number(dashboardSummary.untested || 0);
  const atRiskCount = delayedPlans.length + mostFailedCases.length;

  const dashboardKpis = buildDashboardKpis({
    isGlobalScope,
    passRate: Number(passRate || 0),
    completionRate: Number(completionRate || 0),
    runningRunsCount: Number(dashboardSummary.runningRuns || runningRunsCount || 0),
    atRiskCount,
    blockedCount,
  });

  const executionTrendPoints = useMemo(
    () => buildExecutionTrendPoints(testRuns, 14),
    [testRuns],
  );

  const statusBreakdown = [
    { key: "pass", label: "Pass", value: passCount, color: "#16a34a" },
    { key: "fail", label: "Fail", value: failCount, color: "#ef4444" },
    { key: "blocked", label: "Blocked", value: blockedCount, color: "#f59e0b" },
    { key: "untested", label: "Not Run", value: untestedCount, color: "#6366f1" },
  ];

  const mappedRunningRuns: MappedRunningRun[] = runningRuns
    .map((run: RecordAny, index: number) => {
      const rawProject = run.project ?? run.testPlan?.project ?? null;
      const pid = getId(rawProject) || (typeof rawProject === "string" ? rawProject : "");
      const project = projects.find((p: RecordAny) =>
        getId(p) === pid || String(p._id || "") === pid,
      );
      const projectName = run.project?.name || project?.name || (pid ? pid : "-");
      const projectId = getId(project) || pid;
      const runId = getId(run);
      const versionName = resolveRunVersionName(run, plans, versionHealth, getId);
      return {
        run,
        projectName,
        projectId,
        actionItem: {
          id: String(runId || run.id || index),
          name: String(run.name || run.testPlan?.name || "Untitled Run"),
          projectName,
          projectId,
          versionName,
          testerName: userName(run.startedBy),
          runId: String(runId || ""),
        },
      };
    })
    .filter(({ run, projectName, projectId, actionItem }: MappedRunningRun) =>
      matchesSearch(
        run.name,
        run.testPlan?.name,
        projectName,
        projectId,
        actionItem.versionName,
        userName(run.startedBy),
      ),
    );

  const actionCenterRuns = mappedRunningRuns
    .filter(({ actionItem }) => Boolean(actionItem.runId))
    .map(({ actionItem }) => actionItem);

  const actionCenterDelayedPlans: ActionCenterDelayedPlan[] = delayedPlans
    .filter((plan: RecordAny) => matchesSearch(plan.name, plan.project?.name))
    .slice(0, 2)
    .map((plan: RecordAny, index: number) => ({
      id: String(getId(plan) || index),
      name: String(plan.name || "Untitled plan"),
      projectId: String(getId(plan.project) || ""),
    }))
    .filter((plan: ActionCenterDelayedPlan) => Boolean(plan.projectId));

  const topFailingCaseItems: TopFailingCaseItem[] = mostFailedCases
    .filter((item: RecordAny) =>
      matchesSearch(item.caseKey, item.title, item.project?.name, item.failCount, item.priority),
    )
    .map((item: RecordAny, index: number) => ({
      id: String(item.testCaseId || getId(item) || index),
      caseKey: String(item.caseKey || ""),
      title: String(item.title || "Unknown test case"),
      failCount: Number(item.failCount || 0),
      projectId: getId(item.project) || undefined,
      projectName: item.project?.name ? String(item.project.name) : undefined,
      priority: item.priority ? String(item.priority) : undefined,
    }))
    .filter((item: TopFailingCaseItem) => item.failCount > 0);

  const scopeCompareItems: ScopeCompareItem[] = (isGlobalScope ? projectOverview : versionHealth)
    .filter((item: RecordAny) =>
      isGlobalScope
        ? matchesSearch(item.name, item.code, item.latestVersion, item.progress, item.passRate)
        : matchesSearch(
            item.name,
            item.totalTestPlans,
            item.totalTests,
            item.passRate,
            item.progress,
          ),
    )
    .map((item: RecordAny) =>
      isGlobalScope
        ? {
            id: String(getId(item) || item.code || item.name),
            name: String(item.name || "Untitled"),
            progress: Number(item.progress || 0),
            passRate: Number(item.passRate || 0),
            totalTests: Number(item.totalTests || 0),
            detail: item.latestVersion ? `Latest: ${item.latestVersion}` : undefined,
          }
        : {
            id: String(getId(item) || item._id || item.name),
            name: String(item.name || "Untitled"),
            progress: Number(item.progress || 0),
            passRate: Number(item.passRate || 0),
            totalTests: Number(item.totalTests || 0),
            detail:
              Number(item.totalTestPlans || 0) > 0
                ? `${item.totalTestPlans} plan${Number(item.totalTestPlans) === 1 ? "" : "s"}`
                : undefined,
          },
    )
    .sort((a: ScopeCompareItem, b: ScopeCompareItem) => b.progress - a.progress);

  const handleTopFailingCaseClick = (item: TopFailingCaseItem) => {
    onNavigate?.("test-cases-history", {
      projectId: item.projectId,
      query: { caseKey: item.caseKey || item.title },
    });
  };

  const handleScopeCompareClick = (item: ScopeCompareItem) => {
    if (isGlobalScope) {
      onNavigate?.("versions", item.id);
      return;
    }
    onNavigate?.("test-plans", {
      projectId: selectedProjectId,
      query: { versionId: item.id },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isGlobalScope ? "Portfolio Overview" : "Project Dashboard"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isGlobalScope
              ? "Cross-project execution health and priority risks"
              : `Execution health for ${scopedProjectName || "selected project"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {isGlobalScope ? "Global" : "Project"}
          </span>
          {!isGlobalScope && scopedProjectName ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {scopedProjectName}
            </span>
          ) : null}
        </div>
      </div>

      <DashboardKpiRow items={dashboardKpis} />

      <ExecutionTrendLineChart
        subtitle={
          isGlobalScope
            ? "Runs started and pass/fail results across all projects (last 14 days)"
            : "Runs started and pass/fail results for this project (last 14 days)"
        }
        points={executionTrendPoints}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <StatusBreakdownDonut
          title="Execution Status Mix"
          subtitle="Pass, fail, blocked, and not run"
          items={statusBreakdown}
        />
        <aside className="min-w-0 lg:sticky lg:top-4">
          <DashboardActionCenter
            runs={actionCenterRuns}
            delayedPlans={actionCenterDelayedPlans}
            showProject={isGlobalScope}
            onNavigate={onNavigate}
          />
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TopFailingCasesChart
          items={topFailingCaseItems}
          showProject={isGlobalScope}
          onItemClick={handleTopFailingCaseClick}
        />
        <ScopeCompareBarChart
          title={isGlobalScope ? "Project Progress" : "Version Progress"}
          subtitle={
            isGlobalScope
              ? "Execution completion by project — click a bar to open versions"
              : "Progress by version — click a bar to open plans"
          }
          items={scopeCompareItems}
          emptyText={isGlobalScope ? "No projects found" : "No versions found for this project"}
          onItemClick={handleScopeCompareClick}
        />
      </div>
    </div>
  );
}
