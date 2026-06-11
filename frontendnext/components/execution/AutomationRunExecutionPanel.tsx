"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import FailureScreenshot from "./FailureScreenshot";
import { formatAutomationLiveProgress, getAutomationRunProgress, getId, summarizeRunResults } from "@/lib/api";
import type { Dispatch, SetStateAction } from "react";
import { StatusBadge } from "../workspaceScreens/shared";

type RecordAny = Record<string, any>;

interface AutomationRunExecutionPanelProps {
  selectedRun: RecordAny | null;
  myItems: RecordAny[];
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem?: RecordAny;
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  token: string;
  canControlRun?: boolean;
  cancellingRun?: boolean;
  retryingRun?: boolean;
  onCancelRun?: () => Promise<void>;
  onRetryFailed?: () => Promise<void>;
  onLogBug?: (run: RecordAny, result: RecordAny) => void;
}

export default function AutomationRunExecutionPanel({
  selectedRun,
  myItems,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  notes,
  setNotes,
  token,
  canControlRun = false,
  cancellingRun = false,
  retryingRun = false,
  onCancelRun,
  onRetryFailed,
  onLogBug,
}: AutomationRunExecutionPanelProps) {
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "failed" | "passed" | "blocked">("all");
  const [queueSearch, setQueueSearch] = useState("");
  const canLogBug =
    (selectedRun?.status === "running" || selectedRun?.status === "completed") &&
    selectedItem?.status === "fail";
  const runIsCompleted = String(selectedRun?.status || "") === "completed";
  const runIsRunning = String(selectedRun?.status || "") === "running";

  const statusBadgeClass = (status: string) => {
    if (status === "pass") return "bg-emerald-50 text-emerald-700";
    if (status === "fail") return "bg-rose-50 text-rose-700";
    if (status === "blocked") return "bg-amber-50 text-amber-700";
    if (status === "skip") return "bg-slate-100 text-slate-600";
    return "bg-slate-100 text-slate-500";
  };

  const summary = useMemo(() => summarizeRunResults(myItems), [myItems]);

  const queueItems = useMemo(() => {
    const normalized = queueSearch.trim().toLowerCase();
    return myItems.filter((item: RecordAny) => {
      const status = String(item.status || "untested");
      if (queueFilter === "pending" && !["untested", "skip"].includes(status)) return false;
      if (queueFilter === "failed" && status !== "fail") return false;
      if (queueFilter === "passed" && status !== "pass") return false;
      if (queueFilter === "blocked" && status !== "blocked") return false;
      if (!normalized) return true;
      const key = String(item.testCase?.caseKey || "").toLowerCase();
      const title = String(item.testCase?.title || "").toLowerCase();
      return key.includes(normalized) || title.includes(normalized);
    });
  }, [myItems, queueFilter, queueSearch]);

  const recentActivity = useMemo(() => {
    return [...myItems]
      .filter((item: RecordAny) => Boolean(item.executedAt || item.updatedAt))
      .sort((a: RecordAny, b: RecordAny) =>
        new Date(b.executedAt || b.updatedAt || 0).getTime() -
        new Date(a.executedAt || a.updatedAt || 0).getTime(),
      )
      .slice(0, 6);
  }, [myItems]);

  const runProgress = useMemo(() => getAutomationRunProgress(myItems), [myItems]);
  const liveProgress = useMemo(
    () => formatAutomationLiveProgress(selectedRun?.automationProgress, runProgress),
    [selectedRun?.automationProgress, runProgress],
  );
  const canRetryFailed = runIsCompleted && summary.fail > 0 && canControlRun;

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">Hàng đợi chạy</div>
          <div className="text-xs text-slate-500">Xem kết quả automation (chỉ đọc)</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "Tất cả" },
              { key: "pending", label: "Chưa chạy" },
              { key: "failed", label: "Fail" },
              { key: "passed", label: "Pass" },
              { key: "blocked", label: "Blocked" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={
                  queueFilter === tab.key
                    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                }
                onClick={() => setQueueFilter(tab.key as typeof queueFilter)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
            placeholder="Tìm case key hoặc title"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="max-h-[520px] overflow-auto">
          {queueItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Không tìm thấy case nào</div>
          ) : (
            queueItems.map((item: RecordAny) => {
              const active = getId(item) === selectedItemId;
              return (
                <button
                  key={getId(item)}
                  type="button"
                  className={`flex w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    active ? "bg-slate-50" : ""
                  }`}
                  onClick={() => setSelectedItemId(getId(item))}
                >
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(String(item.status || "untested"))}`}>
                    {item.status}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {item.testCase?.caseKey || "TC"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.testCase?.title || "Untitled"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">Chi tiết case</div>
          <div className="text-xs text-slate-500">Chế độ xem automation (chỉ đọc)</div>
        </div>

        {!selectedItem ? (
          <div className="p-6 text-sm text-slate-500">Chọn một test case từ hàng đợi bên trái.</div>
        ) : (
          <div className="space-y-6 p-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case</div>
              <div className="text-lg font-semibold text-slate-900">
                {selectedItem.testCase?.caseKey || "TC"} - {selectedItem.testCase?.title}
              </div>
              <div className="text-sm text-slate-600">
                {selectedItem.testCase?.description || "No description"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                Automation
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(String(selectedItem.status || "untested"))}`}>
                {selectedItem.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Plan: {selectedRun?.testPlan?.name || selectedRun?.name || "-"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Các bước tự động</div>
              {(selectedItem.testCase?.automation?.steps || []).length === 0 ? (
                <div className="mt-2 text-xs text-slate-500">Chưa cấu hình bước tự động.</div>
              ) : (
                <ol className="mt-3 space-y-2 text-sm text-slate-700">
                  {(selectedItem.testCase?.automation?.steps || []).map((step: RecordAny, index: number) => (
                    <li key={step.stepId || index} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-xs font-semibold text-slate-400">#{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          {step.stepName && (
                            <div className="text-xs font-semibold text-slate-700">{step.stepName}</div>
                          )}
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{step.action}</span>
                            {step.target && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                                {step.targetType}: {step.target}
                              </span>
                            )}
                            {step.value && (
                              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">
                                → {step.value}
                              </span>
                            )}
                            {step.expected && (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                expect: {step.expected}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kết quả mong đợi</div>
              <div className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {selectedItem.testCase?.expected || "N/A"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kết quả chạy</div>
              <div className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {selectedItem.note || notes[getId(selectedItem)] || "Chưa có kết quả"}
              </div>
            </div>

            {selectedRun && getId(selectedRun) && getId(selectedItem) ? (
              <FailureScreenshot
                runId={getId(selectedRun)}
                resultId={getId(selectedItem)}
                failureScreenshot={selectedItem.failureScreenshot}
                status={String(selectedItem.status || "")}
                token={token}
              />
            ) : null}

            {Array.isArray(selectedItem.automationLogs) && selectedItem.automationLogs.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Log chi tiết từng bước</div>
                <ol className="mt-2 space-y-1">
                  {selectedItem.automationLogs.map((log: string, i: number) => (
                    <li key={i} className="rounded bg-white px-2 py-1.5 text-[11px] text-slate-600 border border-slate-100">
                      <span className="mr-1.5 text-slate-400">#{i + 1}</span>
                      {log}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {canLogBug && onLogBug && (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={() => onLogBug(selectedRun, selectedItem)}
              >
                Log Bug
              </button>
            )}
          </div>
        )}
      </section>

      <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">Tổng kết</div>
              <div className="text-xs text-slate-500">
                {runIsCompleted ? "Run đã hoàn tất" : runIsRunning ? liveProgress : "Trạng thái run"}
              </div>
            </div>
            {runIsRunning && canControlRun && onCancelRun ? (
              <button
                type="button"
                disabled={cancellingRun || Boolean(selectedRun?.automationProgress?.cancelRequested)}
                onClick={() => void onCancelRun()}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancellingRun || selectedRun?.automationProgress?.cancelRequested ? "Đang dừng..." : "Stop run"}
              </button>
            ) : null}
            {canRetryFailed && onRetryFailed ? (
              <button
                type="button"
                disabled={retryingRun}
                onClick={() => void onRetryFailed()}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryingRun ? "Đang retry..." : `Retry ${summary.fail} fail`}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Passed</div>
              <div className="text-xl font-semibold text-emerald-600">{summary.pass}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Failed</div>
              <div className="text-xl font-semibold text-rose-600">{summary.fail}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Blocked</div>
              <div className="text-xl font-semibold text-amber-600">{summary.blocked}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Untested</div>
              <div className="text-xl font-semibold text-slate-600">{summary.untested}</div>
            </div>
          </div>

          <div className={`rounded-xl border p-3 text-xs ${
            runIsCompleted
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : runIsRunning
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}>
            {runIsCompleted
              ? "Run automation đã hoàn tất. Bạn có thể xem log từng case và Log Bug cho các case fail."
              : runIsRunning
                ? `${liveProgress} · ${runProgress.percent}% hoàn thành · Trang tự cập nhật mỗi 3 giây.`
                : "Chế độ xem automation — không thể chỉnh sửa kết quả thủ công."}
          </div>

          {runIsRunning && runProgress.total > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Tiến độ</span>
                <span>{runProgress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${runProgress.percent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoạt động gần đây</div>
            <div className="mt-3 space-y-2">
              {recentActivity.length === 0 ? (
                <div className="text-xs text-slate-500">Chưa có cập nhật nào.</div>
              ) : (
                recentActivity.map((item: RecordAny) => (
                  <div key={String(getId(item))} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {item.testCase?.caseKey || "TC"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.status} · {new Date(item.executedAt || item.updatedAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}