"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { scopedPlans: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setRunForm: (updater: any) => void; setActiveTab: (tab: string) => void; };

export default function EmployeeMyTestPlansScreen({ scopedPlans, matchesSearch, setRunForm, setActiveTab }: Props) {
  return <div className="workspace-stack"><SectionCard title="My Test Plans" subtitle="Click vao test plan de vao run test"><DataTable columns={["Test Plan","Project","Version","Action"]} rows={scopedPlans.filter((plan: RecordAny) => matchesSearch(plan.name, plan.project?.name, plan.version?.name)).map((plan: RecordAny) => <><div>{plan.name}</div><div>{plan.project?.name || "-"}</div><div>{plan.version?.name || "-"}</div><div><button type="button" className="workspace-primary" onClick={() => { setRunForm((prev: RecordAny) => ({ ...prev, testPlanId: plan._id })); setActiveTab("execution"); }}>Run</button></div></>)} emptyText="No assigned plans" /></SectionCard></div>;
}