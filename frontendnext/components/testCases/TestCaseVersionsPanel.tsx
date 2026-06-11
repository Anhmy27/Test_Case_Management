"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ACTION_META } from "@/lib/automationStepMeta";
import { StatusBadge } from "@/components/workspaceScreens/shared";

type RecordAny = Record<string, any>;

type Props = {
  testCaseId: string;
};

function summarizeVersionChanges(current: RecordAny, previous: RecordAny | null) {
  if (!previous) {
    return "Initial version";
  }

  const changes: string[] = [];
  if (String(current.title || current.name || "") !== String(previous.title || previous.name || "")) {
    changes.push("title");
  }
  if (String(current.description || "") !== String(previous.description || "")) {
    changes.push("description");
  }
  if (String(current.expected || "") !== String(previous.expected || "")) {
    changes.push("expected");
  }

  const currentSteps = Array.isArray(current.steps) ? current.steps.length : 0;
  const previousSteps = Array.isArray(previous.steps) ? previous.steps.length : 0;
  if (currentSteps !== previousSteps) {
    changes.push(`steps (${previousSteps}→${currentSteps})`);
  }

  const currentAutomationSteps = Array.isArray(current.automation?.steps) ? current.automation.steps.length : 0;
  const previousAutomationSteps = Array.isArray(previous.automation?.steps) ? previous.automation.steps.length : 0;
  if (currentAutomationSteps !== previousAutomationSteps) {
    changes.push(`automation steps (${previousAutomationSteps}→${currentAutomationSteps})`);
  }

  return changes.length > 0 ? changes.join(", ") : "No field changes";
}

function formatAutomationStepLabel(action: string): string {
  return ACTION_META[action]?.label || action || "Step";
}

function AutomationStepsDetail({ automation }: { automation: RecordAny }) {
  const steps = Array.isArray(automation?.steps) ? automation.steps : [];

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation</div>
      <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-zinc-400 sm:grid-cols-2">
        <div><span className="font-semibold text-slate-500">Base URL:</span> {automation.baseUrl || "-"}</div>
        <div><span className="font-semibold text-slate-500">Web ID:</span> {automation.webId || "-"}</div>
        <div><span className="font-semibold text-slate-500">User key:</span> {automation.userKey || "-"}</div>
        <div><span className="font-semibold text-slate-500">Timeout:</span> {automation.timeoutMs ? `${automation.timeoutMs} ms` : "-"}</div>
      </div>
      <div className="mt-3 space-y-2">
        {steps.length === 0 ? (
          <div className="text-xs text-slate-500">No automation steps</div>
        ) : (
          steps.map((step: RecordAny, stepIndex: number) => {
            const actionLabel = formatAutomationStepLabel(String(step.action || ""));
            const title = step.stepName || actionLabel;
            const details: string[] = [];
            if (step.action) details.push(`Action: ${step.action}`);
            if (step.targetType) details.push(`Target type: ${step.targetType}`);
            if (step.target) details.push(`Target: ${step.target}`);
            if (step.value) details.push(`Value: ${step.value}`);
            if (step.expected) details.push(`Expected: ${step.expected}`);
            if (step.timeoutMs) details.push(`Timeout: ${step.timeoutMs} ms`);

            return (
              <div
                key={`${step.stepId || step.order || stepIndex}-${stepIndex}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-semibold text-slate-800 dark:text-zinc-100">
                  {step.order ?? stepIndex + 1}. {title}
                </div>
                <div className="mt-1 text-slate-500">{actionLabel}</div>
                {details.length > 0 ? (
                  <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                    {details.map((line, detailIndex) => (
                      <div key={`${step.stepId || stepIndex}-detail-${detailIndex}`}>{line}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function TestCaseVersionsPanel({ testCaseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [expandedVersionId, setExpandedVersionId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!testCaseId) {
        setVersions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await apiRequest<{ versions: RecordAny[] }>(
          `/api/test-cases/${encodeURIComponent(testCaseId)}/versions`,
        );
        if (!cancelled) {
          setVersions(Array.isArray(response.versions) ? response.versions : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load version history");
          setVersions([]);
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
  }, [testCaseId]);

  const sortedVersions = useMemo(
    () =>
      [...versions].sort(
        (left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0),
      ),
    [versions],
  );

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Loading version history...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>;
  }

  if (sortedVersions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No version history yet. Save changes to this case to create version 2 — each save keeps a snapshot of the previous content.
      </div>
    );
  }

  const hasMultipleVersions = sortedVersions.length > 1;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {hasMultipleVersions
          ? "Read-only version history. Each time you save in Details, a new version is created — older test runs keep their original snapshot."
          : "Version 1 is the current case. Edit and save in Details to create version 2 and start building history."}
      </div>

      <div className="space-y-3">
        {sortedVersions.map((version, index) => {
          const previous = sortedVersions[index + 1] || null;
          const versionKey = String(version._id || version.versionNumber || index);
          const expanded = expandedVersionId === versionKey;
          const changeSummary = summarizeVersionChanges(version, previous);

          return (
            <div key={versionKey} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-zinc-100">
                    Version {version.versionNumber ?? "-"}
                    {version.isLatest ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        latest
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
                    {version.caseKey || version.key} · {version.title || version.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {version.updatedAt || version.createdAt
                      ? new Date(version.updatedAt || version.createdAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                  onClick={() => setExpandedVersionId(expanded ? "" : versionKey)}
                >
                  {expanded ? "Hide details" : "Show details"}
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-600 dark:text-zinc-400">
                Changes vs previous: {changeSummary}
              </div>

              {expanded ? (
                <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-zinc-300">{version.description || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected</div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-zinc-300">{version.expected || "-"}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual steps</div>
                    <div className="mt-2 space-y-2">
                      {(Array.isArray(version.steps) ? version.steps : []).length === 0 ? (
                        <div className="text-xs text-slate-500">No manual steps</div>
                      ) : (
                        version.steps.map((step: RecordAny, stepIndex: number) => (
                          <div key={`${versionKey}-step-${stepIndex}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="font-semibold text-slate-800 dark:text-zinc-100">
                              {step.order ?? stepIndex + 1}. {step.action}
                            </div>
                            {step.expected ? <div className="mt-1 text-slate-600">Expected: {step.expected}</div> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {version.automation?.enabled ? (
                    <AutomationStepsDetail automation={version.automation} />
                  ) : (
                    <div className="text-xs text-slate-500">Automation disabled</div>
                  )}
                  {version.deletedAt ? (
                    <div><StatusBadge status="blocked" /></div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
