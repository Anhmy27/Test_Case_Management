"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  runForm: { testPlanId: string; name: string; baseUrl: string };
  setRunForm: Dispatch<SetStateAction<{ testPlanId: string; name: string; baseUrl: string }>>;
  startRun: (event: React.FormEvent) => Promise<void>;
  scopedPlans: RecordAny[];
  selectedRunPlanIsAutomation: boolean;
  adminRuns: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  userName: (value: unknown) => string;
  currentUserId: string;
  setSelectedRunId: Dispatch<SetStateAction<string>>;
  loadMyItems: (runId: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
};

export default function AdminTestRunsScreen({ runForm, setRunForm, startRun, scopedPlans, selectedRunPlanIsAutomation, adminRuns, matchesSearch, userName, currentUserId, setSelectedRunId, loadMyItems, setActiveTab }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [startedByFilter, setStartedByFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const planOptions = useMemo(
    () =>
      scopedPlans
        .map((plan: RecordAny) => ({ id: getId(plan), name: plan.name || "-" }))
        .sort((a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name)),
    [scopedPlans],
  );

  const startedByOptions = useMemo(() => {
    const seen = new Map<string, string>();

    adminRuns.forEach((run: RecordAny) => {
      const id = getId(run.startedBy) || "";
      if (!id) return;
      if (!seen.has(id)) {
        seen.set(id, userName(run.startedBy));
      }
    });

    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name));
  }, [adminRuns, userName]);

  const filteredRuns = useMemo(
    () => {
      const query = searchTerm.trim();

      return adminRuns.filter((run: RecordAny) => {
        const runPlanId = getId(run.testPlan) || "";
        const startedById = getId(run.startedBy) || "";

        if (planFilter && runPlanId !== planFilter) return false;
        if (startedByFilter && startedById !== startedByFilter) return false;
        if (statusFilter && String(run.status || "") !== statusFilter) return false;

        return matchesSearch(
          query,
          run.name,
          run.testPlan?.name,
          userName(run.startedBy),
          run.status,
          run.progress,
        );
      });
    },
    [adminRuns, matchesSearch, planFilter, searchTerm, startedByFilter, statusFilter, userName],
  );

  return (
    <div className="workspace-stack">
      <SectionCard title="Test Runs" subtitle="Theo doi execution va start/end run rieng">
        <form className="workspace-form" onSubmit={startRun}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Test Plan</span><select value={runForm.testPlanId} onChange={(e) => setRunForm((prev) => ({ ...prev, testPlanId: e.target.value }))} required><option value="">Select plan</option>{scopedPlans.map((plan: RecordAny) => <option key={getId(plan)} value={getId(plan)}>{plan.name}</option>)}</select></label>
            <label><span>Run name</span><input value={runForm.name} onChange={(e) => setRunForm((prev) => ({ ...prev, name: e.target.value }))} required /></label>
          </div>
          <label><span>Automation base URL</span><input value={runForm.baseUrl || ""} onChange={(e) => setRunForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://app.example.com" /></label>
          {selectedRunPlanIsAutomation && <div className="workspace-banner">Automation plan đã được chọn. Khi bạn start run, Playwright sẽ chạy ngay với base URL này.</div>}
          <ActionButton type="submit" label="Start test run" icon="▶" variant="primary" />
        </form>
      </SectionCard>

      <SectionCard title="Test Run List" subtitle="Start / completed runs">
        <div className="workspace-filterbar mb-4">
          <div className="workspace-filterbar__label">
            <span>Run filters</span>
            <p>Loc nhanh theo ten run, plan, nguoi bat dau va trang thai.</p>
          </div>
          <div className="grid flex-1 gap-3 lg:grid-cols-4">
            <label className="workspace-filterbar__control">
              <span className="sr-only">Search runs</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search run, plan, started by..."
              />
            </label>
            <label className="workspace-filterbar__control">
              <span className="sr-only">Filter by plan</span>
              <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
                <option value="">All plans</option>
                {planOptions.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-filterbar__control">
              <span className="sr-only">Filter by started by</span>
              <select value={startedByFilter} onChange={(event) => setStartedByFilter(event.target.value)}>
                <option value="">All starters</option>
                {startedByOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-filterbar__control">
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
        </div>
        <DataTable
          columns={["Run", "Plan", "Progress", "Started by", "Status", "Action"]}
          rows={filteredRuns.map((run: RecordAny) => (
            <>
              <div className="font-medium text-slate-900">{run.name}</div>
              <div>{run.testPlan?.name || "-"}</div>
              <div>{typeof run.progress === "number" ? `${run.progress.toFixed(1)}%` : "0%"}</div>
              <div>{userName(run.startedBy)}</div>
              <div className={run.status === "running" ? "workspace-pill bg-amber-50 text-amber-700" : run.status === "completed" ? "workspace-pill bg-emerald-50 text-emerald-700" : "workspace-pill"}>{run.status}</div>
              <div>
                <ActionButton
                  label={run.status === "running" && (getId(run.startedBy) === currentUserId) ? "Open" : "View"}
                  icon="↗"
                  onClick={() => {
                    const runId = getId(run);
                    if (!runId) return;
                    void loadMyItems(runId);
                  }}
                />
              </div>
            </>
          ))}
          emptyText="No runs"
        />
      </SectionCard>
    </div>
  );
}