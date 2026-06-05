"use client";

import type { ReactNode } from "react";
import type { DashboardNavigateOptions } from "@/components/workspaceScreens/AdminDashboardRoute";

export type VersionHealthRow = {
  _id: string;
  name: string;
  totalTestPlans: number;
  totalTests: number;
  passCount: number;
  failCount: number;
  notRunCount: number;
  progress: number;
  passRate: number;
};

type Props = {
  versions: VersionHealthRow[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  onNavigate?: (tab: string, options?: string | DashboardNavigateOptions) => void;
  projectId?: string;
};

function passRateTone(passRate: number, totalTests: number) {
  if (totalTests <= 0) {
    return "bg-slate-100 text-slate-600";
  }
  if (passRate >= 80) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (passRate >= 50) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-rose-50 text-rose-700";
}

function progressTone(progress: number, totalTests: number) {
  if (totalTests <= 0) {
    return "bg-slate-400";
  }
  if (progress >= 80) {
    return "bg-emerald-500";
  }
  if (progress >= 40) {
    return "bg-amber-500";
  }
  return "bg-rose-500";
}

export default function VersionHealthPanel({
  versions,
  matchesSearch,
  onNavigate,
  projectId,
}: Props) {
  const visibleVersions = versions.filter((version) =>
    matchesSearch(version.name, version.totalTestPlans, version.totalTests, version.passRate, version.progress),
  );

  const summary = {
    total: visibleVersions.length,
    withTests: visibleVersions.filter((version) => version.totalTests > 0).length,
    atRisk: visibleVersions.filter(
      (version) => version.totalTests > 0 && (version.passRate < 50 || version.failCount > version.passCount),
    ).length,
    bestPassRate: visibleVersions.reduce(
      (best, version) =>
        version.totalTests > 0 && version.passRate > best ? version.passRate : best,
      0,
    ),
  };

  const rows: Array<{ id: string; cells: ReactNode[] }> = visibleVersions.map((version) => {
    const progress = Math.max(0, Math.min(100, Number(version.progress || 0)));
    const passRate = Math.max(0, Math.min(100, Number(version.passRate || 0)));

    return {
      id: version._id || version.name,
      cells: [
        <div key="name" className="font-semibold text-slate-900">
          {version.name}
        </div>,
        <div key="plans" className="text-sm text-slate-600">
          {version.totalTestPlans}
        </div>,
        <div key="tests" className="text-sm text-slate-600">
          {version.totalTests}
        </div>,
        <div key="results" className="text-xs text-slate-600">
          <span className="text-emerald-600">{version.passCount} pass</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-rose-600">{version.failCount} fail</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-indigo-600">{version.notRunCount} open</span>
        </div>,
        <span
          key="passRate"
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${passRateTone(passRate, version.totalTests)}`}
        >
          {version.totalTests > 0 ? `${passRate}%` : "N/A"}
        </span>,
        <div key="progress" className="min-w-[140px]">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{progress}%</span>
            <span>{version.totalTests} tests</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${progressTone(progress, version.totalTests)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>,
        <div key="actions" className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onNavigate?.("test-plans", {
                projectId,
                query: { versionId: version._id },
              })
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("versions", projectId)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Version
          </button>
        </div>,
      ],
    };
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-cyan-50/40 shadow-sm">
      <div className="border-b border-sky-100/80 px-6 py-4">
        <div className="text-lg font-semibold text-slate-900">Version Health</div>
        <div className="text-sm text-slate-500">
          Release-level progress, pass rate, and plan coverage for this project
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-4 md:grid-cols-4">
        <div className="rounded-xl border border-sky-100 bg-white/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Versions</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">With runs</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.withTests}</div>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">At risk</div>
          <div className="mt-1 text-xl font-semibold text-rose-700">{summary.atRisk}</div>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Best pass rate</div>
          <div className="mt-1 text-xl font-semibold text-emerald-700">
            {summary.bestPassRate > 0 ? `${summary.bestPassRate}%` : "N/A"}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="max-h-[360px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Plans</th>
                  <th className="px-4 py-3">Tests</th>
                  <th className="px-4 py-3">Results</th>
                  <th className="px-4 py-3">Pass rate</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3 text-right" style={{ width: "160px" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      No versions found for this project
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-slate-50">
                      {row.cells.map((cell, index) => (
                        <td
                          key={index}
                          className={`px-4 py-3 text-slate-700 ${index === row.cells.length - 1 ? "text-right" : ""}`}
                        >
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
      </div>
    </section>
  );
}
