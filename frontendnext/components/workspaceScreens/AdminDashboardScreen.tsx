"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ReactNode } from "react";

type RecordAny = Record<string, any>;

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DataTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
}) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="workspace-table">
      <div className="workspace-table__head" style={columnStyle}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="workspace-table__empty">{emptyText}</div>
      ) : (
        <div className="workspace-table__body">
          {rows.map((row, index) => (
            <div key={index} className="workspace-table__row" style={columnStyle}>
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

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
};

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
}: AdminDashboardScreenProps) {
  const runningRuns = dashboardData.runningTestRuns || [];

  return (
    <div className="workspace-stack">
      {isGlobalScope ? (
        <>
          <SectionCard title="Portfolio Overview" subtitle="Tong quan tat ca project">
            <div className="workspace-metrics">
              <MiniStat label="Projects" value={totalProjects} />
              <MiniStat label="Test Plans" value={totalPlans} />
              <MiniStat label="Test Cases" value={totalCases} />
              <MiniStat label="Running Runs" value={runningRunsCount} />
              <MiniStat label="Users" value={totalUsers} />
            </div>
          </SectionCard>

          <div className="workspace-banner">
            Chon 1 project de xem dashboard chi tiet theo test plan, fail rate, va tester activity.
          </div>

          <div className="workspace-grid workspace-grid--two">
            <SectionCard title="Active Runs" subtitle="Run dang chay tren tat ca project">
              <DataTable
                columns={["Run", "Project", "Tester", "Status"]}
                rows={runningRuns
                  .map((run: RecordAny) => {
                    const rawProject = run.testPlan?.project ?? run.project ?? null;
                    const pid = getId(rawProject) || (typeof rawProject === "string" ? rawProject : "");

                    const proj = projects.find((p: RecordAny) => {
                      const pId = String((p && (p._id ?? p.id)) || "");
                      return pId === pid || String(getId(p)) === pid;
                    });

                    const projectName = proj?.name || (pid ? pid : "-");
                    return { run, projectName };
                  })
                  .filter(({ run, projectName }: { run: RecordAny; projectName: string }) =>
                    matchesSearch(run.name, run.testPlan?.name, projectName, userName(run.startedBy)),
                  )
                  .map(({ run, projectName }: { run: RecordAny; projectName: string }) => (
                    <>
                      <div>{run.name || run.testPlan?.name}</div>
                      <div>{projectName}</div>
                      <div>{userName(run.startedBy)}</div>
                      <div className="workspace-pill workspace-pill--success">Running</div>
                    </>
                  ))}
                emptyText="No running test runs"
              />
            </SectionCard>

            <SectionCard title="Project Health" subtitle="Progress va fail count theo project">
              <DataTable
                columns={["Project", "Progress", "Pass", "Fail"]}
                rows={projectOverview
                  .filter((project: RecordAny) => matchesSearch(project.name, project.code))
                  .map((project: RecordAny) => (
                    <>
                      <div>{project.name}</div>
                      <div>{project.progress}%</div>
                      <div>{project.passCount}</div>
                      <div>{project.failCount}</div>
                    </>
                  ))}
                emptyText="No project metrics"
              />
            </SectionCard>
          </div>

          <SectionCard title="Project Overview" subtitle="Version moi nhat, pass/fail, progress">
            <DataTable
              columns={["Project", "Latest Version", "Pass", "Fail", "Progress"]}
              rows={projectOverview
                .filter((project: RecordAny) => matchesSearch(project.name, project.code, project.latestVersion))
                .map((project: RecordAny) => (
                  <>
                    <div>{project.name}</div>
                    <div>{project.latestVersion}</div>
                    <div>{project.passCount}</div>
                    <div>{project.failCount}</div>
                    <div>{project.progress}%</div>
                  </>
                ))}
              emptyText="No projects found"
            />
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Admin Dashboard" subtitle="Theo doi tien do, loi va tester activity">
            <div className="workspace-metrics">
              <MiniStat label="Running Test Runs" value={dashboardSummary.runningRuns || 0} />
              <MiniStat label="Total Cases" value={dashboardSummary.totalCases || 0} />
              <MiniStat label="Executed" value={dashboardSummary.executed || 0} />
              <MiniStat label="Pass Rate" value={`${dashboardSummary.passRate || 0}%`} />
            </div>
          </SectionCard>

          <div className="workspace-grid workspace-grid--two">
            <SectionCard title="Running Test Runs" subtitle="Ai dang test, plan nao dang chay">
              <DataTable
                columns={["Tester", "Test Plan", "Progress", "Status"]}
                rows={runningRuns
                  .filter((run: RecordAny) => matchesSearch(run.testPlan?.name, run.name, userName(run.startedBy)))
                  .map((run: RecordAny) => (
                    <>
                      <div>{userName(run.startedBy)}</div>
                      <div>{run.testPlan?.name || run.name}</div>
                      <div>{run.progress ?? `${run.results?.length || 0} cases`}</div>
                      <div className="workspace-pill workspace-pill--success">Running</div>
                    </>
                  ))}
                emptyText="No running test runs"
              />
            </SectionCard>

            <SectionCard title="Delayed Test Plans" subtitle="Da assign nhung chua start">
              <DataTable
                columns={["Test Plan", "Project", "Owner"]}
                rows={(dashboardData.delayedTestPlans || [])
                  .filter((plan: RecordAny) => matchesSearch(plan.name, plan.project?.name, userName(plan.owner)))
                  .map((plan: RecordAny) => (
                    <>
                      <div>{plan.name}</div>
                      <div>{plan.project?.name || "-"}</div>
                      <div>{userName(plan.owner)}</div>
                    </>
                  ))}
                emptyText="No delayed plans"
              />
            </SectionCard>
          </div>

          <div className="workspace-grid workspace-grid--two">
            <SectionCard title="Most Failed Test Cases" subtitle="Test case fail nhieu nhat">
              <DataTable
                columns={["Case", "Priority", "Fails"]}
                rows={(dashboardData.mostFailedTestCases || [])
                  .filter((item: RecordAny) => matchesSearch(item.caseKey, item.title, item.priority))
                  .map((item: RecordAny) => (
                    <>
                      <div>{item.caseKey} - {item.title}</div>
                      <div>{item.priority}</div>
                      <div>{item.failCount}</div>
                    </>
                  ))}
                emptyText="No failing cases"
              />
            </SectionCard>

            <SectionCard title="Tester Activity" subtitle="Pass / fail theo tester">
              <DataTable
                columns={["Tester", "Total", "Pass", "Fail"]}
                rows={(dashboardData.testerActivity || [])
                  .filter((item: RecordAny) => matchesSearch(item.name, item.email))
                  .map((item: RecordAny) => (
                    <>
                      <div>{item.name}</div>
                      <div>{item.totalTests}</div>
                      <div>{item.passCount}</div>
                      <div>{item.failCount}</div>
                    </>
                  ))}
                emptyText="No tester activity"
              />
            </SectionCard>
          </div>

          <SectionCard title="Project Overview" subtitle="Tong pass/fail, version moi nhat, progress">
            <DataTable
              columns={["Project", "Latest Version", "Pass", "Fail", "Progress"]}
              rows={projectOverview
                .filter((project: RecordAny) => matchesSearch(project.name, project.code, project.latestVersion))
                .map((project: RecordAny) => (
                  <>
                    <div>{project.name}</div>
                    <div>{project.latestVersion}</div>
                    <div>{project.passCount}</div>
                    <div>{project.failCount}</div>
                    <div>{project.progress}%</div>
                  </>
                ))}
              emptyText="No projects found"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}