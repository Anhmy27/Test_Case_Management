"use client";

import type { DashboardNavigateOptions } from "@/components/workspaceScreens/AdminDashboardRoute";
import {
  chartHeaderClassName,
  chartSurfaceClassName,
  chartTitleClassName,
  dashboardBadgeClassName,
  dashboardGhostButtonClassName,
  dashboardPanelClassName,
} from "./chartTheme";

export type ActionCenterRunItem = {
  id: string;
  name: string;
  projectName: string;
  projectId: string;
  versionName: string;
  runId: string;
};

export type ActionCenterDelayedPlan = {
  id: string;
  name: string;
  projectId: string;
};

type Props = {
  runs: ActionCenterRunItem[];
  delayedPlans?: ActionCenterDelayedPlan[];
  showProject?: boolean;
  embedded?: boolean;
  className?: string;
  onNavigate?: (tab: string, options?: string | DashboardNavigateOptions) => void;
};

export default function DashboardActionCenter({
  runs,
  delayedPlans = [],
  showProject = true,
  embedded = false,
  className = "",
  onNavigate,
}: Props) {
  const visibleDelayedPlans = delayedPlans.slice(0, 2);
  const outer = embedded ? chartSurfaceClassName() : dashboardPanelClassName();

  return (
    <section className={`${outer} flex h-full flex-col ${className}`}>
      <div
        className={`${chartHeaderClassName()} flex min-h-[52px] shrink-0 items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-2">
          {runs.length > 0 ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          ) : null}
          <h2 className={chartTitleClassName()}>Action Center</h2>
        </div>
        <span className={dashboardBadgeClassName("neutral")}>{runs.length} live</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-0">
        {runs.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center">
            <div className="text-[13px] text-zinc-500 dark:text-zinc-400">No running test runs</div>
          </div>
        ) : (
          <ul className="space-y-0">
            {runs.map((run) => (
              <li
                key={run.id}
                className="group border-b border-black/[0.04] py-2.5 last:border-0 transition-colors hover:bg-zinc-50/80 dark:border-white/[0.06] dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    {run.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {showProject ? <span className="truncate">{run.projectName}</span> : null}
                    {run.versionName && run.versionName !== "—" ? (
                      <span className="truncate">{run.versionName}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate?.("test-runs-execution", {
                      projectId: run.projectId,
                      query: { runId: run.runId },
                    })
                  }
                  className={`${dashboardGhostButtonClassName()} mt-2 px-0`}
                >
                  Open run →
                </button>
              </li>
            ))}
          </ul>
        )}

        {visibleDelayedPlans.length > 0 ? (
          <div className="mt-5 border-t border-black/[0.04] pt-4 dark:border-white/[0.06]">
            <div className="mb-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Delayed</div>
            <ul className="space-y-0">
              {visibleDelayedPlans.map((plan) => (
                <li
                  key={plan.id}
                  className="border-b border-black/[0.04] py-2 last:border-0 dark:border-white/[0.06]"
                >
                  <div className="truncate text-[13px] text-zinc-800 dark:text-zinc-100">{plan.name}</div>
                  <button
                    type="button"
                    onClick={() => onNavigate?.("test-plans", plan.projectId)}
                    className={`${dashboardGhostButtonClassName()} mt-1 px-0`}
                  >
                    Review →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
