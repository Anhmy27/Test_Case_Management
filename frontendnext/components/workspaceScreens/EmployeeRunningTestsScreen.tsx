"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = { myScopedRuns: RecordAny[]; matchesSearch: (...values: Array<string | number | undefined | null>) => boolean; setSelectedRunId: (id: string) => void; loadMyItems: (runId: string) => Promise<void>; setActiveTab: (tab: string) => void; userName: (value: unknown) => string; };

export default function EmployeeRunningTestsScreen({ myScopedRuns, matchesSearch, setSelectedRunId, loadMyItems, setActiveTab, userName }: Props) {
  return <div className="workspace-stack"><SectionCard title="Running Tests" subtitle="Run dang chay cua ban"><DataTable columns={["Run","Plan","Status","Action"]} rows={myScopedRuns.filter((run: RecordAny) => run.status === "running").filter((run: RecordAny) => matchesSearch(run.name, run.testPlan?.name, run.status)).map((run: RecordAny) => <><div>{run.name}</div><div>{run.testPlan?.name || "-"}</div><div>{run.status}</div><div><button type="button" className="workspace-secondary" onClick={async () => { setSelectedRunId(run._id); await loadMyItems(run._id); setActiveTab("execution"); }}>Open</button></div></>)} emptyText="No running tests" /></SectionCard></div>;
}