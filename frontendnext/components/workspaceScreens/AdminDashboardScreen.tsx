"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ReactNode } from "react";
import StatusBreakdownDonut from "@/components/dashboard/StatusBreakdownDonut";

type RecordAny = Record<string, any>;

type AdminDashboardScreenProps = {
  isGlobalScope: boolean;
  totalProjects: number;
  totalPlans: number;
  totalCases: number;
  runningRunsCount: number;
  totalUsers: number;
  dashboardSummary: RecordAny;
  dashboardData: RecordAny;
  projectOverview: RecordAny[];
  projects: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  getId: (value: unknown) => string;
  onNavigate?: (tab: string, projectId?: string) => void;
};

type DataGridColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
};

type DataGridRow = {
  id: string;
  cells: ReactNode[];
};

type SummaryCard = {
  label: string;
  value: ReactNode;
  helper?: string;
};

type RunningRunRow = {
  run: RecordAny;
  projectName: string;
  index: number;
};

type RiskRow = {
  id: string;
  cells: ReactNode[];
};

function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle && (
          <div className="text-sm text-slate-500">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </div>
      {helper && <div className="mt-2 text-sm text-slate-500">{helper}</div>}
    </div>
  );
}

function DataGrid({
  columns,
  rows,
  emptyText,
}: {
  columns: DataGridColumn[];
  rows: DataGridRow[];
  emptyText: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[360px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-sm text-slate-500"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition hover:bg-slate-50"
                >
                  {row.cells.map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboardScreen({
  isGlobalScope,
  totalProjects,
  totalPlans,
  totalCases,
  runningRunsCount,
  totalUsers,
  dashboardSummary,
  dashboardData,
  projectOverview,
  projects,
  matchesSearch,
  userName,
  getId,
  onNavigate,
}: AdminDashboardScreenProps) {
  const runningRuns = dashboardData.runningTestRuns || [];
  const delayedPlans = dashboardData.delayedTestPlans || [];
  const mostFailedCases = dashboardData.mostFailedTestCases || [];
  const testerActivity = dashboardData.testerActivity || [];
  const completionRate = dashboardSummary.completionRate || 0;
  const passRate = dashboardSummary.passRate || 0;
  const passCount = Number(dashboardSummary.pass || 0);
  const failCount = Number(dashboardSummary.fail || 0);
  const blockedCount = Number(dashboardSummary.blocked || 0);
  const untestedCount = Number(dashboardSummary.untested || 0);

  const summaryCards: SummaryCard[] = [
    { label: "Running Runs", value: dashboardSummary.runningRuns || runningRunsCount || 0 },
    { label: "Pass Rate", value: `${passRate}%`, helper: "All completed runs" },
    { label: "Completion", value: `${completionRate}%`, helper: "Across active plans" },
    {
      label: "Risk Items",
      value: delayedPlans.length + mostFailedCases.length,
      helper: "Delayed or failing" ,
    },
  ] as const;

  const statusBreakdown = [
    { key: "pass", label: "Passed", value: passCount, color: "#16a34a" },
    { key: "fail", label: "Failed", value: failCount, color: "#ef4444" },
    { key: "blocked", label: "Blocked", value: blockedCount, color: "#f59e0b" },
    { key: "untested", label: "Not run", value: untestedCount, color: "#64748b" },
  ];

  const runningRunRows: DataGridRow[] = runningRuns
    .map((run: RecordAny, index: number) => {
      const rawProject = run.testPlan?.project ?? run.project ?? null;
      const pid = getId(rawProject) || (typeof rawProject === "string" ? rawProject : "");
      const project = projects.find((p: RecordAny) => getId(p) === pid);
      const projectName = project?.name || (pid ? pid : "-");
      return { run, projectName, index };
    })
    .filter(({ run, projectName }: RunningRunRow) =>
      matchesSearch(run.name, run.testPlan?.name, projectName, userName(run.startedBy)),
    )
    .map(({ run, projectName, index }: RunningRunRow) => ({
      id: String(getId(run) || run.id || index),
      cells: [
        <div key="run" className="font-semibold text-slate-900">
          {run.name || run.testPlan?.name || "Untitled Run"}
        </div>,
        <div key="project" className="text-sm text-slate-600">
          {projectName}
        </div>,
        <div key="tester" className="text-sm text-slate-600">
          {userName(run.startedBy)}
        </div>,
        <span
          key="status"
          className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
        >
          Running
        </span>,
        <button
          key="action"
          type="button"
          onClick={() => onNavigate?.("test-runs")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          Open
        </button>,
      ],
    }));

  const riskRows: DataGridRow[] = [
    ...delayedPlans.map((plan: RecordAny, index: number) => ({
      id: `delayed-${getId(plan) || index}`,
      cells: [
        <div key="item" className="font-semibold text-slate-900">
          {plan.name}
        </div>,
        <div key="project" className="text-sm text-slate-600">
          {plan.project?.name || "-"}
        </div>,
        <span
          key="signal"
          className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
        >
          Delayed plan
        </span>,
        <span
          key="status"
          className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
        >
          Attention
        </span>,
        <button
          key="action"
          type="button"
          onClick={() => onNavigate?.("test-plans", getId(plan.project))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          Review
        </button>,
      ],
    })),
    ...mostFailedCases.slice(0, 5).map((item: RecordAny, index: number) => ({
      id: `fail-${getId(item) || index}`,
      cells: [
        <div key="item" className="font-semibold text-slate-900">
          {item.caseKey} - {item.title}
        </div>,
        <div key="project" className="text-sm text-slate-600">
          {item.project?.name || "-"}
        </div>,
        <span
          key="signal"
          className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
        >
          {item.failCount} fails
        </span>,
        <span
          key="status"
          className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700"
        >
          High risk
        </span>,
        <button
          key="action"
          type="button"
          onClick={() => onNavigate?.("test-cases-history")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          Investigate
        </button>,
      ],
    })),
  ]
    .filter((row: RiskRow) => row.cells.some((cell: ReactNode) => Boolean(cell)))
    .filter((row: RiskRow) => {
      const text = row.cells
        .map((cell: ReactNode) => {
          if (typeof cell === "string") return cell;
          if (typeof cell === "number") return String(cell);
          return "";
        })
        .join(" ");
      return matchesSearch(text);
    });

  const projectRows = projectOverview
    .filter((project: RecordAny) =>
      matchesSearch(project.name, project.code, project.latestVersion),
    )
    .map((project: RecordAny) => ({
      id: String(getId(project) || project.code || project.name),
      cells: [
        <div key="project" className="font-semibold text-slate-900">
          {project.name}
        </div>,
        <div key="version" className="text-sm text-slate-600">
          {project.latestVersion || "-"}
        </div>,
        <div key="pass" className="text-sm text-slate-600">
          {project.passCount}
        </div>,
        <div key="fail" className="text-sm text-slate-600">
          {project.failCount}
        </div>,
        <div key="progress" className="min-w-[140px]">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{project.progress}%</span>
            <span>{project.totalTests || 0} tests</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${Math.max(0, Math.min(100, project.progress || 0))}%` }}
            />
          </div>
        </div>,
        <button
          key="action"
          type="button"
          onClick={() => onNavigate?.("versions", getId(project) || "")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          View
        </button>,
      ],
    }));

  const testerRows = testerActivity
    .filter((item: RecordAny) => matchesSearch(item.name, item.email))
    .map((item: RecordAny, index: number) => ({
      id: String(getId(item) || index),
      cells: [
        <div key="tester" className="font-semibold text-slate-900">
          {item.name}
        </div>,
        <div key="total" className="text-sm text-slate-600">
          {item.totalTests}
        </div>,
        <div key="pass" className="text-sm text-emerald-600">
          {item.passCount}
        </div>,
        <div key="fail" className="text-sm text-rose-600">
          {item.failCount}
        </div>,
        <button
          key="action"
          type="button"
          onClick={() => onNavigate?.("users")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          Review
        </button>,
      ],
    }));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title={isGlobalScope ? "Portfolio Overview" : "QA Command Center"}
          subtitle={
            isGlobalScope
              ? "Cross-project operational health and immediate risks"
              : "Active progress, execution risk, and tester throughput"
          }
          actions={
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {isGlobalScope ? "Global" : "Project"}
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Projects" value={totalProjects} />
          <MetricCard label="Test Plans" value={totalPlans} />
          <MetricCard label="Test Cases" value={totalCases} />
          <MetricCard label="Users" value={totalUsers} />
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card: SummaryCard) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              helper={card.helper}
            />
          ))}
        </div>
        <div className="px-6 pb-6">
          <StatusBreakdownDonut
            title="Execution mix"
            subtitle="Biểu đồ trạng thái giúp đọc nhanh pass/fail/blocked"
            items={statusBreakdown}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            title="Action Center"
            subtitle="Runs that need immediate attention"
          />
          <DataGrid
            columns={[
              { key: "run", label: "Run" },
              { key: "project", label: "Project" },
              { key: "tester", label: "Tester" },
              { key: "status", label: "Status", align: "center", width: "120px" },
              { key: "action", label: "Action", align: "right", width: "120px" },
            ]}
            rows={runningRunRows}
            emptyText="No running test runs"
          />
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="Risk Radar"
            subtitle="Delayed plans and high-failure cases"
          />
          <DataGrid
            columns={[
              { key: "item", label: "Item" },
              { key: "project", label: "Project" },
              { key: "signal", label: "Signal" },
              { key: "status", label: "Status", align: "center", width: "120px" },
              { key: "action", label: "Action", align: "right", width: "120px" },
            ]}
            rows={riskRows}
            emptyText="No risk items"
          />
        </div>
      </div>

      {!isGlobalScope && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <SectionHeader
              title="Tester Activity"
              subtitle="Pass/fail distribution by tester"
            />
            <DataGrid
              columns={[
                { key: "tester", label: "Tester" },
                { key: "total", label: "Total" },
                { key: "pass", label: "Pass" },
                { key: "fail", label: "Fail" },
                { key: "action", label: "Action", align: "right", width: "120px" },
              ]}
              rows={testerRows}
              emptyText="No tester activity"
            />
          </div>

          <div className="space-y-4">
            <SectionHeader
              title="Project Health"
              subtitle="Latest version signal and progress"
            />
            <DataGrid
              columns={[
                { key: "project", label: "Project" },
                { key: "version", label: "Latest Version" },
                { key: "pass", label: "Pass" },
                { key: "fail", label: "Fail" },
                { key: "progress", label: "Progress" },
                { key: "action", label: "Action", align: "right", width: "120px" },
              ]}
              rows={projectRows}
              emptyText="No projects found"
            />
          </div>
        </div>
      )}

      {isGlobalScope && (
        <div className="space-y-4">
          <SectionHeader
            title="Project Health"
            subtitle="Portfolio progress across all projects"
          />
          <DataGrid
            columns={[
              { key: "project", label: "Project" },
              { key: "version", label: "Latest Version" },
              { key: "pass", label: "Pass" },
              { key: "fail", label: "Fail" },
              { key: "progress", label: "Progress" },
              { key: "action", label: "Action", align: "right", width: "120px" },
            ]}
            rows={projectRows}
            emptyText="No projects found"
          />
        </div>
      )}
    </div>
  );
}
