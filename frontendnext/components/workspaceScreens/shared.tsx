"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

// ─── Form primitives ──────────────────────────────────────────────────────

/** Shared Tailwind class for all text inputs, selects, and textareas */
export const INPUT_CLS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20";

/** Wraps a label + field slot pair */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

/** Readonly project when scoped, otherwise a project `<select>`. */
export function ScopedProjectField({
  isProjectScoped,
  scopedProjectName,
  projectId,
  projects,
  onProjectChange,
  getId,
  required = true,
}: {
  isProjectScoped: boolean;
  scopedProjectName?: string;
  projectId: string;
  projects: Array<{ name?: string } & Record<string, unknown>>;
  onProjectChange: (projectId: string) => void;
  getId: (value: unknown) => string;
  required?: boolean;
}) {
  if (isProjectScoped) {
    return (
      <Field label="Project">
        <input
          className={`${INPUT_CLS} bg-slate-50 dark:bg-zinc-800/50`}
          value={scopedProjectName || "Selected project"}
          readOnly
        />
      </Field>
    );
  }

  return (
    <Field label="Project">
      <select
        className={INPUT_CLS}
        value={projectId}
        onChange={(event) => onProjectChange(event.target.value)}
        required={required}
      >
        <option value="">Select project</option>
        {projects.map((project) => (
          <option key={getId(project)} value={getId(project)}>
            {project.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Compact input/select styling for workspace route topbars. */
export const TOPBAR_INPUT_CLS =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20";

// ─── FilterBar ────────────────────────────────────────────────────────────

/**
 * Horizontal row of filter controls.
 * `cols` controls how many columns the controls section uses (default 4).
 */
export function FilterBar({
  label,
  description,
  children,
  cols = 4,
}: {
  label?: string;
  description?: string;
  children: ReactNode;
  cols?: number;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      {(label || description) && (
        <div className="w-40 shrink-0">
          {label && (
            <p className="text-xs font-semibold text-slate-700">{label}</p>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
      )}
      <div
        className={`grid flex-1 gap-3`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── FilterControl ────────────────────────────────────────────────────────

export function FilterControl({ children }: { children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">Filter</span>
      {children}
    </label>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

export function WorkspaceContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-20 rounded-2xl bg-slate-200/70 dark:bg-zinc-800" />
      <div className="h-56 rounded-2xl bg-slate-200/50 dark:bg-zinc-800/80" />
      <div className="h-80 rounded-2xl bg-slate-200/40 dark:bg-zinc-800/60" />
    </div>
  );
}

// ─── StatusBadge ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pass:      "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30",
  fail:      "bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-500/30",
  blocked:   "bg-amber-50 text-amber-800 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30",
  skip:      "bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/40",
  running:   "bg-sky-50 text-sky-700 ring-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30",
  completed: "bg-slate-100 text-slate-700 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600/40",
  pending:   "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30",
  automation:"bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-500/30",
  manual:    "bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/40",
  active:    "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30",
  inactive:  "bg-slate-100 text-slate-500 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/40",
};

export function StatusBadge({ status }: { status: string }) {
  const key = String(status || "").toLowerCase();
  const cls = STATUS_STYLES[key] ?? "bg-slate-100 text-slate-600 ring-slate-200/60";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  /** Visible label text. Can also use `children` instead. */
  label?: string;
  children?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  tooltip?: string;
  className?: string;
};

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  secondary:
    "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-700",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60",
  ghost:
    "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-xs gap-1.5",
  lg: "px-4 py-2 text-sm gap-2",
};

export function Button({
  label,
  children,
  icon,
  onClick,
  disabled,
  loading,
  variant = "secondary",
  size = "md",
  tooltip,
  type,
  className = "",
}: ButtonProps) {
  const content = children ?? label;
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip ?? (typeof content === "string" ? content : undefined)}
      aria-label={typeof content === "string" ? content : label}
      className={`inline-flex items-center rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <span className="shrink-0" aria-hidden="true">{icon}</span>
      ) : null}
      {content !== undefined && <span>{content}</span>}
    </button>
  );
}

// Backward-compat alias
export { Button as ActionButton };

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({
  title,
  subtitle,
  children,
  actions,
  noPadding = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          {title ? (
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>}
            </div>
          ) : null}
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      )}
      {noPadding ? children : <div className="p-5">{children}</div>}
    </section>
  );
}

// SectionCard backward-compat alias
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
    <Card title={title} subtitle={subtitle} actions={actions}>
      {children}
    </Card>
  );
}

// ─── PageHeader ────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? (
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"
            />
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── DataTable ─────────────────────────────────────────────────────────────

export function DataTable({
  columns,
  rows,
  emptyText,
  pageSize = 15,
  enablePagination = true,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
  pageSize?: number;
  enablePagination?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const colStyle = {
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
    <div className="overflow-hidden">
      {/* Head */}
      <div
        className="grid gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
        style={colStyle}
      >
        {columns.map((col) => (
          <div key={col}>{col}</div>
        ))}
      </div>

      {/* Body */}
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div>
          {visibleRows.map((row, i) => (
            <div
              key={i}
              className="grid items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/70"
              style={colStyle}
            >
              {row}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {enablePagination && rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500">
          <span>
            {rows.length} items · trang {safePage}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              ← Trước
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Tiếp →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
