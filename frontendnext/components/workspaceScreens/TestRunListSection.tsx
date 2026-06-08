"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Button, DataTable, FilterBar, INPUT_CLS, SectionCard, StatusBadge } from "./shared";
import { formatRunProgressPercent, getRunListActionLabel, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  runs: RecordAny[];
  scopedPlans: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  onOpenRun: (runId: string) => void;
  activeRunId?: string;
};

export default function TestRunListSection({
  runs,
  scopedPlans,
  matchesSearch,
  userName,
  onOpenRun,
  activeRunId = "",
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [startedByFilter, setStartedByFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const filteredRuns = useMemo(() => {
    const query = searchTerm.trim();
    return runs.filter((run: RecordAny) => {
      const runPlanId = getId(run.testPlan) || "";
      const startedById = getId(run.startedBy) || "";
      if (planFilter && runPlanId !== planFilter) return false;
      if (startedByFilter && startedById !== startedByFilter) return false;
      if (statusFilter && String(run.status || "") !== statusFilter) return false;
      return matchesSearch(
        query,
        run.name,
        run.project?.name,
        run.version?.name,
        run.testPlan?.name,
        userName(run.startedBy),
        run.status,
        run.progress,
      );
    });
  }, [matchesSearch, planFilter, runs, searchTerm, startedByFilter, statusFilter, userName]);

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
        </select>
      </FilterBar>

      <div className="mt-4">
        <DataTable
          columns={["Run", "Project", "Version", "Plan", "Progress", "Started by", "Status", "Action"]}
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
                <div>
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
