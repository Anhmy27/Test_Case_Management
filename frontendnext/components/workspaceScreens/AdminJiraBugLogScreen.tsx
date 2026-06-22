"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Button, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type Props = {
  logBugs: RecordAny[];
  message: string;
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onOpenExecution: (entry: RecordAny) => void;
};

function formatWhen(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function extractCaseFromSummary(summary: unknown) {
  const text = String(summary || "").trim();
  const match = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return { caseKey: "", caseTitle: text };
  }
  return {
    caseKey: String(match[1] || "").trim(),
    caseTitle: String(match[2] || "").trim(),
  };
}

function resolveCaseLabel(entry: RecordAny) {
  const fromSummary = extractCaseFromSummary(entry?.summary);
  const caseKey = String(entry?.caseKey || fromSummary.caseKey || "").trim();
  const caseTitle = String(entry?.caseTitle || fromSummary.caseTitle || "").trim();
  return {
    caseKey,
    caseTitle,
    display: caseKey && caseTitle ? `${caseKey} - ${caseTitle}` : caseKey || caseTitle || "-",
  };
}

type DetailRowProps = {
  label: string;
  value: string;
  multiline?: boolean;
};

function DetailRow({ label, value, multiline = false }: DetailRowProps) {
  return (
    <div className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</div>
      <div className={`text-sm text-slate-700 dark:text-zinc-200 ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value || "-"}
      </div>
    </div>
  );
}

export default function AdminJiraBugLogScreen({
  logBugs,
  message,
  pagination,
  onPageChange,
  onOpenExecution,
}: Props) {
  const [detailLog, setDetailLog] = useState<RecordAny | null>(null);
  const detailCase = useMemo(() => (detailLog ? resolveCaseLabel(detailLog) : null), [detailLog]);

  return (
    <div className="space-y-5">
      <SectionCard
        title="Jira Bug Log"
        subtitle="History of bugs logged to Jira for the selected project"
      >
        {message ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </div>
        ) : null}

        <DataTable
          columns={["When", "Jira Issue", "Summary", "Test Case", "Test Run", "Actions", "Logged By"]}
          rows={logBugs.map((entry) => (
            <>
              <div className="whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                {formatWhen(entry.createdAt)}
              </div>
              <div>
                {entry.jiraLocation ? (
                  <a
                    href={entry.jiraLocation}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                  >
                    {entry.issueKeyJira || "-"}
                  </a>
                ) : (
                  <div className="font-medium text-slate-900 dark:text-zinc-100">
                    {entry.issueKeyJira || "-"}
                  </div>
                )}
                {entry.priority ? (
                  <div className="text-xs text-slate-500 dark:text-zinc-500">Priority {entry.priority}</div>
                ) : null}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">{entry.summary || "-"}</div>
                {entry.assignee ? (
                  <div className="text-xs text-slate-500 dark:text-zinc-500">Assignee: {entry.assignee}</div>
                ) : null}
              </div>
              <div>
                {(() => {
                  const caseInfo = resolveCaseLabel(entry);
                  return (
                    <>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">
                        {caseInfo.caseKey || "-"}
                      </div>
                      {caseInfo.caseTitle ? (
                        <div className="truncate text-xs text-slate-500 dark:text-zinc-500">{caseInfo.caseTitle}</div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">
                  {entry.testRun?.name || "-"}
                </div>
                {entry.testRun?._id ? (
                  <div className="truncate text-xs text-slate-500 dark:text-zinc-500">{entry.testRun._id}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  label="View detail"
                  onClick={() => setDetailLog(entry)}
                />
                <Button
                  size="sm"
                  label="Open"
                  disabled={!entry.testRun?._id}
                  onClick={() => onOpenExecution(entry)}
                />
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">
                  {entry.loggedBy?.name || "-"}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-500">
                  {entry.loggedBy?.email || entry.loggedBy?.role || "-"}
                </div>
              </div>
            </>
          ))}
          emptyText="No Jira bugs logged for this project yet"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-zinc-400">
            Page {pagination.page} / {pagination.pages} · {pagination.total} entries
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              label="Previous"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            />
            <Button
              size="sm"
              label="Next"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
            />
          </div>
        </div>
      </SectionCard>

      {detailLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 dark:bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jira-log-detail-title"
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h3 id="jira-log-detail-title" className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                  Jira Bug Log Detail
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Read-only information for this bug log.
                </p>
              </div>
              <Button size="sm" label="Close" onClick={() => setDetailLog(null)} />
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-auto px-5 py-4">
              <DetailRow label="When" value={formatWhen(detailLog.createdAt)} />
              <DetailRow label="Issue Key Jira" value={String(detailLog.issueKeyJira || "")} />
              <DetailRow label="Jira URL" value={String(detailLog.jiraLocation || "")} />
              <DetailRow label="Project" value={String(detailLog.project || "")} />
              <DetailRow label="Test Run" value={String(detailLog.testRun?._id || "")} />
              <DetailRow label="Test Run Name" value={String(detailLog.testRun?.name || "")} />
              <DetailRow label="Run Result _id" value={String(detailLog.runResult || "")} />
              <DetailRow label="Test Case" value={detailCase?.display || "-"} />
              <DetailRow label="Issue Type" value={String(detailLog.issueType || "")} />
              <DetailRow label="Priority" value={String(detailLog.priority || "")} />
              <DetailRow label="Assignee" value={String(detailLog.assignee || "")} />
              <DetailRow label="Labels" value={String(detailLog.labels || "")} />
              <DetailRow
                label="Versions"
                value={(Array.isArray(detailLog.versions) ? detailLog.versions : []).join(", ")}
              />
              <DetailRow label="Summary" value={String(detailLog.summary || "")} multiline />
              <DetailRow label="Description" value={String(detailLog.description || "")} multiline />
              <DetailRow
                label="Logged By"
                value={
                  detailLog.loggedBy
                    ? `${detailLog.loggedBy.name || "-"} (${detailLog.loggedBy.email || detailLog.loggedBy.role || "-"})`
                    : "-"
                }
              />
              <DetailRow label="Log _id" value={String(detailLog._id || "")} />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button
                size="sm"
                label="Open"
                disabled={!detailLog.testRun?._id}
                onClick={() => onOpenExecution(detailLog)}
              />
              <Button size="sm" label="Close" onClick={() => setDetailLog(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
