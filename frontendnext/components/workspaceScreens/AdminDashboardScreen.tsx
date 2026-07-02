"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from "react";
import StatusBreakdownDonut from "@/components/dashboard/StatusBreakdownDonut";
import ExecutionTrendLineChart from "@/components/dashboard/ExecutionTrendLineChart";
import { buildExecutionTrendPoints } from "@/components/dashboard/buildExecutionTrend";
import {
  DASHBOARD_GUTTER,
  dashboardPanelClassName,
  dashboardSectionLabelClassName,
} from "@/components/dashboard/chartTheme";
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
  runningRunsCount: number;
  dashboardSummary: RecordAny;
  dashboardData: RecordAny;
  testRuns: RecordAny[];
  versionHealth: RecordAny[];
  projectOverview: RecordAny[];
  projects: RecordAny[];
  plans: RecordAny[];
  selectedProjectId?: string;
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
      label: "Pass rate",
      value: `${passRate}%`,
      helper: "Across executed results in scope",
      hint: "pass / (pass + fail + blocked + skip)",
    },
    {
      id: "completion",
      label: "Completion",
      value: `${completionRate}%`,
      helper: "Share of planned results executed",
      hint: "(pass + fail + blocked + skip) / total results in runs",
    },
    {
      id: "running-runs",
      label: "Running runs",
      value: runningRunsCount,
      helper: "Test runs currently in progress",
    },
    isGlobalScope
      ? {
          id: "at-risk",
          label: "At risk",
          value: atRiskCount,
          helper: "Delayed plans + high-failure cases",
          hint: "Count of delayed plans and top failing cases in scope",
        }
      : {
          id: "blocked",
          label: "Blocked",
          value: blockedCount,
          helper: "Results blocked during execution",
          hint: "Blocked results across runs in this project",
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
  runningRunsCount,
  dashboardSummary,
  dashboardData,
  testRuns,
  versionHealth,
  projectOverview,
  projects,
  plans,
  selectedProjectId,
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
  const skipCount = Number(dashboardSummary.skip || 0);
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
    { key: "pass", label: "Pass", value: passCount },
    { key: "fail", label: "Fail", value: failCount },
    { key: "blocked", label: "Blocked", value: blockedCount },
    { key: "skip", label: "Skip", value: skipCount },
    { key: "untested", label: "Not run", value: untestedCount },
  ];

  const mappedRunningRuns: MappedRunningRun[] = runningRuns
    .map((run: RecordAny, index: number) => {
      const rawProject = run.project ?? run.testPlan?.project ?? null;
      const pid = getId(rawProject) || (typeof rawProject === "string" ? rawProject : "");
      const project = projects.find((p: RecordAny) => getId(p) === pid);
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
          runId: String(runId || ""),
        },
      };
    });

  const actionCenterRuns = mappedRunningRuns
    .filter(({ actionItem }) => Boolean(actionItem.runId))
    .map(({ actionItem }) => actionItem);

  const actionCenterDelayedPlans: ActionCenterDelayedPlan[] = delayedPlans
    .slice(0, 2)
    .map((plan: RecordAny, index: number) => ({
      id: String(getId(plan) || index),
      name: String(plan.name || "Untitled plan"),
      projectId: String(getId(plan.project) || ""),
    }))
    .filter((plan: ActionCenterDelayedPlan) => Boolean(plan.projectId));

  const topFailingCaseItems: TopFailingCaseItem[] = mostFailedCases
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
            id: String(getId(item) || item.name),
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
    });
  };

  const scopeModeLabel = isGlobalScope ? "Global scope" : "Project scope";
  const scopeModeDescription = isGlobalScope
    ? "Cross-project comparison and portfolio-level risks"
    : "Execution health and version insights for selected project";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 dark:border-white/[0.08] dark:bg-zinc-900/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {scopeModeLabel}
            </div>
            <div className="text-[13px] text-zinc-700 dark:text-zinc-300">{scopeModeDescription}</div>
          </div>
          {!isGlobalScope ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.("test-plans", { projectId: selectedProjectId })}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Open test plans
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.("test-runs-execution", { projectId: selectedProjectId })}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Open execution
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <DashboardKpiRow items={dashboardKpis} />

      <section>
        <div className={`${dashboardSectionLabelClassName()} ${DASHBOARD_GUTTER}`}>
          {isGlobalScope ? "Portfolio overview" : "Project execution overview"}
        </div>
        <div className={dashboardPanelClassName()}>
          <ExecutionTrendLineChart
            embedded
            subtitle={
              isGlobalScope ? "Last 14 days · all projects" : "Last 14 days · this project"
            }
            points={executionTrendPoints}
          />
          <div className="border-t border-black/[0.05] lg:grid lg:grid-cols-[minmax(0,1.2fr)_260px] lg:items-stretch dark:border-white/[0.06]">
            <StatusBreakdownDonut embedded title="Status mix" items={statusBreakdown} />
            <DashboardActionCenter
              embedded
              className="border-t border-black/[0.05] lg:border-t-0 lg:border-l lg:border-black/[0.05] dark:border-white/[0.06]"
              runs={actionCenterRuns}
              delayedPlans={isGlobalScope ? actionCenterDelayedPlans : []}
              showProject={isGlobalScope}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </section>

      <section>
        <div className={`${dashboardSectionLabelClassName()} ${DASHBOARD_GUTTER}`}>
          {isGlobalScope ? "Cross-project insights" : "Project deep dive"}
        </div>
        <div className={dashboardPanelClassName()}>
          <div className="grid xl:grid-cols-2 xl:divide-x xl:divide-black/[0.05]">
            <TopFailingCasesChart
              embedded
              title={isGlobalScope ? "Top failing cases across projects" : "Top failing cases in this project"}
              items={topFailingCaseItems}
              showProject={isGlobalScope}
              onItemClick={handleTopFailingCaseClick}
            />
            <ScopeCompareBarChart
              embedded
              title={isGlobalScope ? "Project progress comparison" : "Version progress in this project"}
              subtitle="Click a bar to drill down"
              items={scopeCompareItems}
              emptyText={isGlobalScope ? "No projects found" : "No versions found"}
              onItemClick={handleScopeCompareClick}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
