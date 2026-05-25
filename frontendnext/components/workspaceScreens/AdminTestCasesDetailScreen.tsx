"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  selectedProjectId: string;
  detailGroupId: string;
  setDetailGroupId: (value: string) => void;
  scopedGroups: RecordAny[];
  detailLoading: boolean;
  detailRows: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminTestCasesDetailScreen({ selectedProjectId, detailGroupId, setDetailGroupId, scopedGroups, detailLoading, detailRows, matchesSearch }: Props) {
  const safeDetailRows = Array.isArray(detailRows) ? detailRows : [];

  return (
    <div className="workspace-stack">
      {!selectedProjectId ? (
        <div className="workspace-banner">Hay chon project trong Project scope de xem Test Cases Detail.</div>
      ) : (
        <>
          <SectionCard title="Test Cases Detail" subtitle="Loc theo group va xem 3 status pass/fail/blocked/skip gan nhat">
            <div className="workspace-filterbar">
              <div className="workspace-filterbar__label">
                <span>Group filter</span>
                <p>Chon group de rut gon danh sach test case.</p>
              </div>
              <label className="workspace-filterbar__control">
                <select value={detailGroupId} onChange={(e) => setDetailGroupId(e.target.value)}>
                  <option value="">All groups</option>
                  {scopedGroups.map((group: RecordAny) => <option key={group._id} value={group._id}>{group.name}</option>)}
                </select>
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Test Case List">
            {detailLoading ? (
              <div className="workspace-table__empty">Loading...</div>
            ) : (
              <DataTable
                columns={["Case", "Group", "Priority", "Recent 1", "Recent 2", "Recent 3"]}
                rows={safeDetailRows.filter((testCase: RecordAny) => matchesSearch(testCase.caseKey, testCase.title, testCase.group?.name, testCase.priority, ...(testCase.recentStatuses || []))).map((testCase: RecordAny) => {
                  const statuses = Array.isArray(testCase.recentStatuses) ? testCase.recentStatuses : [];
                  const statusCell = (status?: string) => <span className={status ? `workspace-pill status-${status}` : "workspace-pill"}>{status || "-"}</span>;
                  return (
                    <>
                      <div>{testCase.caseKey || testCase.key} - {testCase.title || testCase.name}</div>
                      <div>{testCase.group?.name || "-"}</div>
                      <div>{testCase.priority || "-"}</div>
                      <div>{statusCell(statuses[0])}</div>
                      <div>{statusCell(statuses[1])}</div>
                      <div>{statusCell(statuses[2])}</div>
                    </>
                  );
                })}
                emptyText="No test cases in this project"
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}