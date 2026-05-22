"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setSelectedRunId: (id: string) => void; loadMyItems: (runId: string) => Promise<void>; setActiveTab: (tab: string) => void; userName: (value: unknown) => string; };

export default function EmployeeHistoryScreen({ myScopedRuns, matchesSearch, setSelectedRunId, loadMyItems, setActiveTab, userName }: Props) {
  return <div className="workspace-stack"><SectionCard title="History" subtitle="Lich su execution"><DataTable columns={["Run","Plan","Status","Started By","Action"]} rows={myScopedRuns.filter((run: RecordAny) => run.status === "completed").filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status, userName(run.startedBy))).map((run: RecordAny) => <><div>{run.name}</div><div>{run.testPlan?.name || "-"}</div><div>{run.status}</div><div>{userName(run.startedBy)}</div><div><button type="button" className="workspace-secondary" onClick={async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); }}>View</button></div></>)} emptyText="No history yet" /></SectionCard></div>;
}