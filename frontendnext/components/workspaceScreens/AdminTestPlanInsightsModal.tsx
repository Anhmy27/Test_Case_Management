"use client";

import { Fragment, useEffect, useState } from "react";
import { useOptionalWorkspaceNotice } from "@/components/workspaceScreens/WorkspaceNotice";
import { apiRequest } from "@/lib/api";
import { DataTable, SectionCard, StatusBadge } from "./shared";
import TestCaseExecutionHistoryPopup from "./TestCaseExecutionHistoryPopup";
import type { RunExecutionEntry, RunHistory, TestCaseInsight, TestPlanDetail } from "@/lib/tcmTypes";

type Props = {
  planId: string;
  planName?: string;
  projectId?: string;
  onClose: () => void;
  onOpenExecution?: (runId: string) => void;
  onStartNewRun?: () => void;
};

type CaseFilter = "all" | "failing" | "not_run";

function matchesCaseFilter(item: TestCaseInsight, filter: CaseFilter) {
  const status = String(item.latestStatus || "untested").toLowerCase();
  if (filter === "failing") {
    return status === "fail";
  }
  if (filter === "not_run") {
    return status === "untested" || !(item.runExecutionHistory || []).length;
  }
  return true;
}

function runLabel(index: number, total: number): string {
  if (total <= 1) return "Run";
  return `#${index + 1}`;
}

function CompactRunTimeline({ entries }: { entries: RunExecutionEntry[] }) {
  if (!entries.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {entries.map((entry, index) => {
        const isLatest = index === entries.length - 1;
        return (
          <span
            key={`${entry.runId}-${index}`}
            className={`inline-flex items-center gap-1 ${isLatest ? "rounded-md ring-1 ring-indigo-200 bg-indigo-50/50 px-1 dark:ring-indigo-800 dark:bg-indigo-950/30" : ""}`}
            title={`${entry.runName} — ${String(entry.status || "untested")}`}
          >
            <span className="text-[10px] tabular-nums text-slate-400">{runLabel(index, entries.length)}</span>
            <StatusBadge status={String(entry.status || "untested")} />
          </span>
        );
      })}
    </div>
  );
}

function TestCasesPanel({
  testCases,
  onViewCase,
  emptyText = "No test cases in this plan",
}: {
  testCases: TestPlanDetail["testCases"];
  onViewCase: (item: TestCaseInsight) => void;
  emptyText?: string;
}) {
  if (!testCases.length) {
    return <div className="px-4 py-10 text-center text-sm text-slate-400">{emptyText}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[minmax(120px,1fr)_72px_minmax(180px,2fr)_52px] items-center gap-x-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-950">
          <div>Case</div>
          <div>Latest</div>
          <div>Results per run (old → new)</div>
          <div />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {testCases.map((item) => (
            <div
              key={item.testCaseId}
              className="grid grid-cols-[minmax(120px,1fr)_72px_minmax(180px,2fr)_52px] items-center gap-x-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900 dark:text-zinc-100">{item.caseKey}</div>
                <div className="truncate text-xs text-slate-500" title={item.title}>{item.title}</div>
              </div>
              <div>
                <StatusBadge status={String(item.latestStatus || "untested")} />
              </div>
              <CompactRunTimeline entries={item.runExecutionHistory || []} />
              <div>
                <button
                  type="button"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  onClick={() => onViewCase(item)}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminTestPlanInsightsModal({
  planId,
  planName,
  projectId: projectIdProp,
  onClose,
  onOpenExecution,
  onStartNewRun,
}: Props) {
  const noticeContext = useOptionalWorkspaceNotice();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<TestPlanDetail | null>(null);
  const [viewingCase, setViewingCase] = useState<TestCaseInsight | null>(null);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("all");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiRequest<TestPlanDetail>(
          `/api/dashboard/test-plans/${encodeURIComponent(planId)}`,
        );
        if (!cancelled) {
          setDetail(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load plan insights");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  useEffect(() => {
    if (!error || !noticeContext) {
      return;
    }
    noticeContext.showNotice(error, "error");
  }, [error, noticeContext]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (viewingCase) {
          setViewingCase(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewingCase]);

  const resolvedProjectId = detail?.projectId || projectIdProp || "";

  const title = detail?.testPlanName || planName || "Test plan insights";
  const allTestCases = detail?.testCases || [];
  const filteredTestCases = allTestCases.filter((item) => matchesCaseFilter(item, caseFilter));
  const failingCount = allTestCases.filter((item) => matchesCaseFilter(item, "failing")).length;
  const notRunCount = allTestCases.filter((item) => matchesCaseFilter(item, "not_run")).length;

  const caseFilterTabs: Array<{ key: CaseFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: allTestCases.length },
    { key: "failing", label: "Failing", count: failingCount },
    { key: "not_run", label: "Not run", count: notRunCount },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-insights-title"
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div id="plan-insights-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                {title}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {[detail?.project, detail?.version].filter(Boolean).join(" · ") || "Plan overview"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onStartNewRun ? (
                <button
                  type="button"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  onClick={onStartNewRun}
                >
                  ▶ Start new run
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                onClick={onClose}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-slate-500">Unable to load plan insights.</div>
          ) : !detail?.testPlanId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Plan not found or has no data yet.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Total cases</div>
                  <div className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">{detail.summary.totalTests}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">Pass rate</div>
                  <div className="text-2xl font-semibold text-emerald-800 dark:text-emerald-300">{detail.summary.passRate}%</div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                  <div className="text-xs uppercase tracking-wide text-indigo-700">Progress</div>
                  <div className="text-2xl font-semibold text-indigo-800 dark:text-indigo-300">{detail.summary.progress}%</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/30">
                  <div className="text-xs uppercase tracking-wide text-rose-700">Failing</div>
                  <div className="text-2xl font-semibold text-rose-800 dark:text-rose-300">{detail.summary.failCount}</div>
                </div>
              </div>

              <SectionCard title="Run history" subtitle="Newest first">
                <DataTable
                  columns={["Run", "Pass", "Fail", "Blocked", "Not run", "Started", ""]}
                  rows={(detail.runHistory || []).map((run: RunHistory) => (
                    <Fragment key={run.runId}>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{run.runName}</div>
                      <div>{run.passCount}</div>
                      <div>{run.failCount}</div>
                      <div>{run.blockedCount}</div>
                      <div>{run.notRunCount}</div>
                      <div className="text-xs text-slate-500">
                        {run.executedAt ? new Date(run.executedAt).toLocaleString() : "-"}
                      </div>
                      <div>
                        {onOpenExecution && run.runId ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            onClick={() => onOpenExecution(String(run.runId))}
                          >
                            Open
                          </button>
                        ) : null}
                      </div>
                    </Fragment>
                  ))}
                  emptyText="No runs yet"
                />
              </SectionCard>

              <SectionCard
                title="Test cases"
                subtitle="Kết quả từng case qua các run — hover # để xem tên run, ô cuối là run mới nhất"
              >
                <div className="mb-3 flex flex-wrap gap-2 px-1">
                  {caseFilterTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCaseFilter(tab.key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        caseFilter === tab.key
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
                <TestCasesPanel
                  testCases={filteredTestCases}
                  onViewCase={setViewingCase}
                  emptyText={
                    allTestCases.length === 0
                      ? "No test cases in this plan"
                      : "No cases match this filter"
                  }
                />
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      {viewingCase ? (
        <TestCaseExecutionHistoryPopup
          caseKey={viewingCase.caseKey}
          caseTitle={viewingCase.title}
          projectId={resolvedProjectId || undefined}
          fallbackHistory={viewingCase.runExecutionHistory}
          onClose={() => setViewingCase(null)}
        />
      ) : null}
    </div>
  );
}
