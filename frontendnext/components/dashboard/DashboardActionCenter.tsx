"use client";

import type { DashboardNavigateOptions } from "@/components/workspaceScreens/AdminDashboardRoute";

export type ActionCenterRunItem = {
  id: string;
  name: string;
  projectName: string;
  projectId: string;
  versionName: string;
  testerName: string;
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
  onOpenRun?: (projectId: string, runId: string) => void;
  onReviewPlan?: (projectId: string) => void;
  onNavigate?: (tab: string, options?: string | DashboardNavigateOptions) => void;
};

export default function DashboardActionCenter({
  runs,
  delayedPlans = [],
  showProject = true,
  onOpenRun,
  onReviewPlan,
  onNavigate,
}: Props) {
  const visibleDelayedPlans = delayedPlans.slice(0, 2);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {runs.length > 0 ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              ) : null}
              <h2 className="text-base font-semibold text-slate-900">Action Center</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Runs needing immediate attention</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {runs.length} active
          </span>
        </div>
      </div>

      <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <div className="text-sm font-medium text-slate-700">No running test runs</div>
            <div className="mt-1 text-xs text-slate-500">New runs in progress will appear here.</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-slate-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{run.name}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {showProject ? (
                        <span className="truncate rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {run.projectName}
                        </span>
                      ) : null}
                      {run.versionName && run.versionName !== "—" ? (
                        <span className="truncate rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                          {run.versionName}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      Tester: {run.testerName || "—"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Running
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenRun) {
                      onOpenRun(run.projectId, run.runId);
                      return;
                    }
                    onNavigate?.("test-runs-execution", {
                      projectId: run.projectId,
                      query: { runId: run.runId },
                    });
                  }}
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Open run
                </button>
              </li>
            ))}
          </ul>
        )}

        {visibleDelayedPlans.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Delayed plans
            </div>
            <ul className="space-y-2">
              {visibleDelayedPlans.map((plan) => (
                <li
                  key={plan.id}
                  className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5"
                >
                  <div className="truncate text-sm font-medium text-slate-900">{plan.name}</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onReviewPlan) {
                        onReviewPlan(plan.projectId);
                        return;
                      }
                      onNavigate?.("test-plans", plan.projectId);
                    }}
                    className="mt-2 text-xs font-semibold text-amber-800 hover:text-amber-950"
                  >
                    Review plan →
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
