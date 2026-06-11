"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getEndRunPolicy, setEndRunPolicy, summarizeRunResults, getId, type EndRunPolicy } from "@/lib/api";
import type { Dispatch, SetStateAction } from "react";
import { ConfirmDialog, StatusBadge } from "../workspaceScreens/shared";

type RecordAny = Record<string, any>;

interface ManualRunExecutionPanelProps {
  selectedRun: RecordAny | null;
  myItems: RecordAny[];
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem?: RecordAny;
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  onUpdateResult: (
    resultId: string,
    status: "pass" | "fail" | "blocked" | "skip",
    note: string,
    notes: string,
  ) => void;
  onEndRun: () => void | Promise<void>;
  canEditRun: boolean;
  canEndRun?: boolean;
  onLogBug?: (run: RecordAny, result: RecordAny) => void;
}

export default function ManualRunExecutionPanel({
  selectedRun,
  myItems,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  notes,
  setNotes,
  onUpdateResult,
  onEndRun,
  canEditRun,
  canEndRun = false,
  onLogBug,
}: ManualRunExecutionPanelProps) {
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "failed" | "passed" | "blocked" | "skip">("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [endRunPolicy, setEndRunPolicyState] = useState<EndRunPolicy>("flexible");

  const getExpectedResultText = (testCase: RecordAny) => {
    const overall = String(testCase?.expected || "").trim();
    if (overall) {
      return overall;
    }

    const steps = Array.isArray(testCase?.steps) ? testCase.steps : [];
    const uniqueExpected = Array.from(
      new Set(
        steps
          .map((step: RecordAny) => String(step.expected || "").trim())
          .filter(Boolean),
      ),
    );

    return uniqueExpected.length > 0 ? uniqueExpected.join("\n") : "N/A";
  };

  const currentIndex = myItems.findIndex((item: RecordAny) => getId(item) === selectedItemId);
  const nextItem = currentIndex >= 0
    ? myItems.slice(currentIndex + 1).find((item: RecordAny) => item.status !== "pass") || myItems[currentIndex + 1]
    : undefined;
  const previousItem = currentIndex > 0 ? myItems[currentIndex - 1] : undefined;

  const summary = useMemo(() => summarizeRunResults(myItems), [myItems]);

  useEffect(() => {
    setEndRunPolicyState(getEndRunPolicy());
  }, [showEndRunDialog]);

  const canLogBug =
    (selectedRun?.status === "running" || selectedRun?.status === "completed") &&
    selectedItem?.status === "fail";
  const strictEndBlocked = endRunPolicy === "strict" && summary.untested > 0;

  const queueItems = useMemo(() => {
    const normalized = queueSearch.trim().toLowerCase();
    return myItems.filter((item: RecordAny) => {
      const status = String(item.status || "untested");
      if (queueFilter === "pending" && status !== "untested") return false;
      if (queueFilter === "failed" && status !== "fail") return false;
      if (queueFilter === "passed" && status !== "pass") return false;
      if (queueFilter === "blocked" && status !== "blocked") return false;
      if (queueFilter === "skip" && status !== "skip") return false;
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

  const goToNextItem = useCallback(async () => {
    if (!nextItem) {
      return;
    }

    setSelectedItemId(getId(nextItem));
  }, [nextItem, setSelectedItemId]);

  useEffect(() => {
    if (!canEditRun) return;

    const handler = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (!selectedItemId) return;

      if (event.key === "j" || event.key === "ArrowDown") {
          if (nextItem) setSelectedItemId(getId(nextItem));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
          if (previousItem) setSelectedItemId(getId(previousItem));
        return;
      }

      const noteValue = notes[selectedItemId] || "";
      const extraNotes = notes[`${selectedItemId}:notes`] || "";

      if (event.key === "1") {
        await onUpdateResult(selectedItemId, "pass", noteValue, extraNotes);
        void goToNextItem();
      } else if (event.key === "2") {
        await onUpdateResult(selectedItemId, "fail", noteValue, extraNotes);
        void goToNextItem();
      } else if (event.key === "3") {
        await onUpdateResult(selectedItemId, "blocked", noteValue, extraNotes);
        void goToNextItem();
      } else if (event.key === "4") {
        await onUpdateResult(selectedItemId, "skip", noteValue, extraNotes);
        void goToNextItem();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canEditRun, goToNextItem, nextItem, notes, onUpdateResult, previousItem, selectedItemId, setSelectedItemId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">Execution queue</div>
          <div className="text-xs text-slate-500">Navigate by status and search</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "failed", label: "Failed" },
              { key: "passed", label: "Passed" },
              { key: "blocked", label: "Blocked" },
              { key: "skip", label: "Skip" },
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
            placeholder="Search case"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="max-h-[520px] overflow-auto">
          {queueItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No cases found</div>
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
                  <StatusBadge status={String(item.status || "untested")} />
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
          <div className="text-sm font-semibold text-slate-900">Case detail</div>
          <div className="text-xs text-slate-500">Steps, expected, actual</div>
        </div>

        {!selectedItem ? (
          <div className="p-6 text-sm text-slate-500">Select a test case from the queue.</div>
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
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                {selectedItem.testCase?.priority || "n/a"}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {selectedItem.testCase?.severity || "n/a"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {selectedItem.testCase?.type || "functional"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Owner: {selectedItem.tester?.name || selectedItem.owner?.name || "-"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</div>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                {(selectedItem.testCase?.steps || []).map((step: RecordAny, index: number) => (
                  <li key={index} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="mr-2 text-xs text-slate-400">#{index + 1}</span>
                    {step.action || step}
                    {step.expected && (
                      <div className="mt-1 text-xs text-slate-500">→ {step.expected}</div>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected</div>
              <div className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {getExpectedResultText(selectedItem.testCase)}
              </div>
            </div>

            <div className="grid gap-4">
              <label className="text-xs font-semibold text-slate-500">Actual result
                <textarea
                  rows={4}
                  value={notes[getId(selectedItem)] ?? selectedItem.note ?? ""}
                  readOnly={!canEditRun}
                  onChange={(e) =>
                    canEditRun &&
                    setNotes((prev) => ({
                      ...prev,
                      [getId(selectedItem)]: e.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">Notes
                <textarea
                  rows={3}
                  value={notes[`${getId(selectedItem)}:notes`] ?? selectedItem.notes ?? ""}
                  readOnly={!canEditRun}
                  onChange={(e) =>
                    canEditRun &&
                    setNotes((prev) => ({
                      ...prev,
                      [`${getId(selectedItem)}:notes`]: e.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        )}
      </section>

      <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">Execution summary</div>
          <div className="text-xs text-slate-500">Quick status + keyboard hints</div>
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
              <div className="text-xs text-slate-500">Skip</div>
              <div className="text-xl font-semibold text-slate-600">{summary.skip}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 col-span-2">
              <div className="text-xs text-slate-500">Untested</div>
              <div className="text-xl font-semibold text-slate-600">{summary.untested}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Shortcuts: J/K = next/prev, 1 = pass, 2 = fail, 3 = blocked, 4 = skip.
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</div>
            <div className="mt-3 space-y-2">
              {recentActivity.length === 0 ? (
                <div className="text-xs text-slate-500">No recent updates.</div>
              ) : (
                recentActivity.map((item: RecordAny) => (
                  <div key={String(getId(item))} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {item.testCase?.caseKey || "TC"}
                    </div>
                    <div className="text-xs text-slate-500">
                      <StatusBadge status={String(item.status || "untested")} /> · {new Date(item.executedAt || item.updatedAt || 0).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                disabled={!previousItem}
                  onClick={() => previousItem && setSelectedItemId(getId(previousItem))}
              >
                Previous
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                disabled={!nextItem}
                onClick={() => nextItem && setSelectedItemId(getId(nextItem))}
              >
                Next
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "pass", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
                disabled={!canEditRun}
              >
                Pass
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "fail", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
                disabled={!canEditRun}
              >
                Fail
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "blocked", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
                disabled={!canEditRun}
              >
                Blocked
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "skip", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
                disabled={!canEditRun}
              >
                Skip
              </button>
            </div>
            <div className="flex items-center gap-2">
              {canLogBug && onLogBug && selectedItem ? (
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                  onClick={() => onLogBug(selectedRun, selectedItem)}
                >
                  Log bug
                </button>
              ) : null}
              <button
                type="button"
                className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setShowEndRunDialog(true)}
                disabled={!canEndRun}
                title={canEndRun ? "End this test run" : "Only an active manual run you can edit can be ended"}
              >
                End run
              </button>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={showEndRunDialog}
        title="End test run?"
        description="Review the summary below before completing this run."
        confirmLabel="End run"
        cancelLabel="Keep running"
        confirmVariant="danger"
        confirmDisabled={strictEndBlocked}
        onCancel={() => setShowEndRunDialog(false)}
        onConfirm={() => {
          setShowEndRunDialog(false);
          void onEndRun();
        }}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-2">
            <div>Pass: <strong>{summary.pass}</strong></div>
            <div>Fail: <strong>{summary.fail}</strong></div>
            <div>Blocked: <strong>{summary.blocked}</strong></div>
            <div>Skip: <strong>{summary.skip}</strong></div>
            <div className="col-span-2">Untested: <strong>{summary.untested}</strong></div>
          </div>
          {summary.untested > 0 ? (
            <div className={`rounded-lg border px-3 py-2 text-xs ${strictEndBlocked ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {strictEndBlocked
                ? "Strict mode is enabled. Complete or skip all remaining cases before ending this run."
                : "This run still has untested cases. You can end now, but the report will remain incomplete."}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            End run policy
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={endRunPolicy}
              onChange={(event) => {
                const nextPolicy = event.target.value as EndRunPolicy;
                setEndRunPolicyState(nextPolicy);
                setEndRunPolicy(nextPolicy);
              }}
            >
              <option value="flexible">Flexible — allow end with untested cases</option>
              <option value="strict">Strict — block end while untested cases remain</option>
            </select>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
