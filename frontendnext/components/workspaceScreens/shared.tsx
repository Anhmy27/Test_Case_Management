"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export function WorkspaceContentSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-24 rounded-2xl bg-slate-200/80" />
      <div className="h-64 rounded-2xl bg-slate-200/60" />
      <div className="h-96 rounded-2xl bg-slate-200/40" />
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  icon?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  tooltip?: string;
  className?: string;
};

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div
        className="workspace-card__header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}
      >
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="workspace-inline-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  columns,
  rows,
  emptyText,
  pageSize = 10,
  enablePagination = true,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
  pageSize?: number;
  enablePagination?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const columnStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const visibleRows = useMemo(() => {
    if (!enablePagination) return rows;
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [enablePagination, pageSize, rows, safePage]);

  return (
    <div className="workspace-table">
      <div className="workspace-table__head" style={columnStyle}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="workspace-table__empty">{emptyText}</div>
      ) : (
        <div className="workspace-table__body">
          {visibleRows.map((row, index) => (
            <div key={index} className="workspace-table__row" style={columnStyle}>
              {row}
            </div>
          ))}
        </div>
      )}
      {enablePagination && rows.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 px-2 py-2 text-xs text-slate-600">
          <span>
            Page {safePage}/{totalPages} · {rows.length} items
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  loading,
  variant = "secondary",
  tooltip,
  type,
  className,
}: ActionButtonProps) {
  const base = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition";
  const tone =
    variant === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : variant === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
        : variant === "ghost"
          ? "border-transparent bg-transparent text-slate-600 hover:bg-slate-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";

  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip || label}
      aria-label={label}
      className={`${base} ${tone} disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
    >
      {loading ? "…" : icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}