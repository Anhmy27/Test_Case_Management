"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { scopedPlans: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setRunForm: (updater: any) => void; setActiveTab: (tab: string) => void; };

export default function EmployeeMyTestPlansScreen({ scopedPlans, matchesSearch, setRunForm, setActiveTab }: Props) {
  const [focusedPlanId, setFocusedPlanId] = useState<string>("");
  const filteredPlans = scopedPlans.filter((plan: RecordAny) => matchesSearch(plan.name, plan.project?.name, plan.version?.name));
  const focusedPlan = useMemo(
    () => filteredPlans.find((plan: RecordAny) => String(plan._id) === String(focusedPlanId)) || filteredPlans[0] || null,
    [filteredPlans, focusedPlanId],
  );

  return (
    <div className="workspace-stack">
      <SectionCard title="My Test Plans" subtitle="Click vao test plan de vao run test">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <DataTable
            columns={["Test Plan", "Project", "Version", "Action"]}
            rows={filteredPlans.map((plan: RecordAny) => (
              <>
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setFocusedPlanId(String(plan._id))}>{plan.name}</button>
                <div>{plan.project?.name || "-"}</div>
                <div>{plan.version?.name || "-"}</div>
                <div><ActionButton label="Run" icon="▶" variant="primary" onClick={() => { setRunForm((prev: RecordAny) => ({ ...prev, testPlanId: plan._id })); setActiveTab("execution"); }} /></div>
              </>
            ))}
            emptyText="No assigned plans"
          />
          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Related panel</div>
            {!focusedPlan ? (
              <div className="mt-2 text-slate-500">No plan selected</div>
            ) : (
              <div className="mt-2 space-y-2">
                <div><strong>Plan:</strong> {focusedPlan.name || "-"}</div>
                <div><strong>Project:</strong> {focusedPlan.project?.name || "-"}</div>
                <div><strong>Version:</strong> {focusedPlan.version?.name || "-"}</div>
                <div><strong>Cases:</strong> {(focusedPlan.items || []).length}</div>
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">Trace: Plan → Run setup → Execution</div>
              </div>
            )}
          </aside>
        </div>
      </SectionCard>
    </div>
  );
}