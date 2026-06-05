"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Button, DataTable, Field, FilterBar, INPUT_CLS, SectionCard, StatusBadge } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };
  setRunForm: Dispatch<SetStateAction<{ testPlanId: string; name: string; baseUrl: string }>>;
  startRun: (event: React.FormEvent) => Promise<void>;
  startingRun?: boolean;
  scopedPlans: RecordAny[];
  selectedRunPlanIsAutomation: boolean;
  adminRuns: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  currentUserId: string;
  loadMyItems: (runId: string) => Promise<void>;
};

export default function AdminTestRunsScreen({
  runForm,
  setRunForm,
  startRun,
  startingRun = false,
  scopedPlans,
  selectedRunPlanIsAutomation,
  adminRuns,
  matchesSearch,
  userName,
  currentUserId,
  loadMyItems,
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
    adminRuns.forEach((run: RecordAny) => {
      const id = getId(run.startedBy) || "";
      if (!id) return;
      if (!seen.has(id)) seen.set(id, userName(run.startedBy));
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [adminRuns, userName]);

  const filteredRuns = useMemo(() => {
    const query = searchTerm.trim();
    return adminRuns.filter((run: RecordAny) => {
      const runPlanId = getId(run.testPlan) || "";
      const startedById = getId(run.startedBy) || "";
      if (planFilter && runPlanId !== planFilter) return false;
      if (startedByFilter && startedById !== startedByFilter) return false;
      if (statusFilter && String(run.status || "") !== statusFilter) return false;
      return matchesSearch(query, run.name, run.testPlan?.name, userName(run.startedBy), run.status, run.progress);
    });
  }, [adminRuns, matchesSearch, planFilter, searchTerm, startedByFilter, statusFilter, userName]);

  return (
    <div className="space-y-5">
      <SectionCard title="Start Test Run" subtitle="Chọn test plan và khởi chạy test run mới">
        <form className="space-y-4" onSubmit={startRun}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test Plan">
              <select
                className={INPUT_CLS}
                value={runForm.testPlanId}
                onChange={(e) => setRunForm((prev) => ({ ...prev, testPlanId: e.target.value }))}
                required
                disabled={startingRun}
              >
                <option value="">Select plan</option>
                {scopedPlans.map((plan: RecordAny) => (
                  <option key={getId(plan)} value={getId(plan)}>
                    {plan.name} ({plan.executionMode || "manual"})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Run name">
              <input
                className={INPUT_CLS}
                value={runForm.name}
                onChange={(e) => setRunForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={startingRun}
              />
            </Field>
          </div>
          {selectedRunPlanIsAutomation && (
            <Field label="Automation base URL">
              <input
                className={INPUT_CLS}
                value={runForm.baseUrl || ""}
                onChange={(e) => setRunForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://app.example.com"
                disabled={startingRun}
              />
            </Field>
          )}
          {selectedRunPlanIsAutomation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Plan automation: Playwright chạy ngay khi Start run. Quá trình có thể mất vài phút — vui lòng chờ.
            </div>
          )}
          <Button type="submit" variant="primary" loading={startingRun} disabled={startingRun}>
            {startingRun
              ? selectedRunPlanIsAutomation
                ? "Đang chạy Playwright..."
                : "Đang start run..."
              : "▶ Start test run"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Test Run List" subtitle="Danh sách tất cả test run">
        <FilterBar label="Run filters" description="Lọc theo tên, plan, người bắt đầu và trạng thái" cols={4}>
          <input
            type="search"
            className={INPUT_CLS}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search run, plan..."
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
            columns={["Run", "Plan", "Progress", "Started by", "Status", "Action"]}
            rows={filteredRuns.map((run: RecordAny) => (
              <>
                <div className="font-medium text-slate-900">{run.name}</div>
                <div className="text-slate-600">{run.testPlan?.name || "-"}</div>
                <div className="text-slate-600">
                  {typeof run.progress === "number" ? `${run.progress.toFixed(1)}%` : "0%"}
                </div>
                <div className="text-slate-600">{userName(run.startedBy)}</div>
                <div>
                  <StatusBadge status={run.status || "untested"} />
                </div>
                <div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const runId = getId(run);
                      if (!runId) return;
                      void loadMyItems(runId);
                    }}
                  >
                    {run.status === "running" && getId(run.startedBy) === currentUserId ? "Open ↗" : "View ↗"}
                  </Button>
                </div>
              </>
            ))}
            emptyText="No runs"
          />
        </div>
      </SectionCard>
    </div>
  );
}
