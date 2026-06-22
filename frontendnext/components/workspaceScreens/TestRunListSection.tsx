"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { Button, DataTable, FilterBar, INPUT_CLS, SectionCard, StatusBadge } from "./shared";
import { createTextMatcher, formatRunProgressPercent, getRunListActionLabel, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  runs: RecordAny[];
  scopedPlans: RecordAny[];
  userName: (value: unknown) => string;
  onOpenRun: (runId: string) => void;
  onOpenRunForEdit?: (runId: string) => void;
  onExportRun?: (runId: string, format?: "xlsx" | "csv") => Promise<void>;
  activeRunId?: string;
  initialPlanFilter?: string;
};

export default function TestRunListSection({
  runs,
  scopedPlans,
  userName,
  onOpenRun,
  onOpenRunForEdit,
  onExportRun,
  activeRunId = "",
  initialPlanFilter = "",
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState(initialPlanFilter);
  const [startedByFilter, setStartedByFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setPlanFilter(initialPlanFilter);
  }, [initialPlanFilter]);

  const planOptions = useMemo(
    () =>
      scopedPlans
        .map((plan: RecordAny) => ({ id: getId(plan), name: plan.name || "-" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scopedPlans],
  );

  const startedByOptions = useMemo(() => {
    const seen = new Map<string, string>();
    runs.forEach((run: RecordAny) => {
      const id = getId(run.startedBy) || "";
      if (!id) return;
      if (!seen.has(id)) seen.set(id, userName(run.startedBy));
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [runs, userName]);

  const matchText = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const filteredRuns = useMemo(() => runs.filter((run: RecordAny) => {
    const runPlanId = getId(run.testPlan) || "";
    const startedById = getId(run.startedBy) || "";
    if (planFilter && runPlanId !== planFilter) return false;
    if (startedByFilter && startedById !== startedByFilter) return false;
    if (statusFilter && statusFilter !== "has_failures" && String(run.status || "") !== statusFilter) return false;
    if (statusFilter === "has_failures") {
      const failCount = Number(run.failCount ?? 0);
      if (failCount <= 0) return false;
    }
    return matchText(
      run.name,
      run.project?.name,
      run.version?.name,
      run.testPlan?.name,
      userName(run.startedBy),
      run.status,
    );
  }), [matchText, planFilter, runs, startedByFilter, statusFilter, userName]);

  return (
    <SectionCard title="Test Run List" subtitle="Running and completed runs — select a run to open the execution workbench">
      <FilterBar label="Run filters" description="Filter by name, project, plan, starter, and status" cols={4}>
        <input
          type="search"
          className={INPUT_CLS}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search run, project, plan..."
        />
        <select className={INPUT_CLS} value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
          <option value="">All plans</option>
          {planOptions.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
        <select className={INPUT_CLS} value={startedByFilter} onChange={(event) => setStartedByFilter(event.target.value)}>
          <option value="">All starters</option>
          {startedByOptions.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select className={INPUT_CLS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="has_failures">Has failures</option>
        </select>
      </FilterBar>

      <div className="mt-4">
        <DataTable
          columns={["Run", "Project", "Version", "Plan", "Progress", "Started by", "Status", "Action"]}
          getRowProps={(index) => {
            const run = filteredRuns[index];
            const runId = run ? getId(run) : "";
            if (!runId) return {};
            return {
              onDoubleClick: () => onOpenRun(runId),
              title: "Double-click to open run",
              className: "cursor-default",
            };
          }}
          rows={filteredRuns.map((run: RecordAny) => {
            const runId = getId(run);
            const isActive = Boolean(activeRunId && runId === activeRunId);
            const actionLabel = getRunListActionLabel(String(run.status || ""), isActive);
            return (
              <>
                <div className={`font-medium ${isActive ? "text-blue-700" : "text-slate-900"}`}>{run.name}</div>
                <div className="text-slate-600">{run.project?.name || "-"}</div>
                <div className="text-slate-600">{run.version?.name || "-"}</div>
                <div className="text-slate-600">{run.testPlan?.name || "-"}</div>
                <div className="text-slate-600">{formatRunProgressPercent(run.progress)}</div>
                <div className="text-slate-600">{userName(run.startedBy)}</div>
                <div>
                  <StatusBadge status={run.status || "untested"} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={isActive ? "primary" : "secondary"}
                    onClick={() => {
                      if (!runId) return;
                      onOpenRun(runId);
                    }}
                  >
                    {actionLabel}
                  </Button>
                  {onOpenRunForEdit && runId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpenRunForEdit(runId)}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {onExportRun && runId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onExportRun(runId, "xlsx")}
                    >
                      Export
                    </Button>
                  ) : null}
                </div>
              </>
            );
          })}
          emptyText="No runs"
        />
      </div>
    </SectionCard>
  );
}
