"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type Props = {
  logs: RecordAny[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
};

function formatAction(action: unknown) {
  return String(action || "-").replace(/\./g, " · ");
}

function formatWhen(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function AdminAuditLogScreen({ logs, pagination, onPageChange }: Props) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Audit Log"
        subtitle="Global activity trail — visible only when project scope is All projects"
      >
        <DataTable
          columns={["When", "Action", "Resource", "Actor", "IP"]}
          rows={logs.map((entry) => (
            <>
              <div className="whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                {formatWhen(entry.createdAt)}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">{formatAction(entry.action)}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                  {entry.resourceType || "-"}
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">
                  {entry.resourceLabel || entry.resourceId || "-"}
                </div>
                {entry.resourceId ? (
                  <div className="truncate text-xs text-slate-500 dark:text-zinc-500">{entry.resourceId}</div>
                ) : null}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-zinc-100">{entry.userName || "-"}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-500">{entry.userEmail || entry.userRole || "-"}</div>
              </div>
              <div className="text-sm text-slate-600 dark:text-zinc-400">{entry.clientIp || "-"}</div>
            </>
          ))}
          emptyText="No audit entries yet"
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
    </div>
  );
}
