"use client";

import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";

export const DEFAULT_CLIENT_PAGE_SIZE = 15;

// ─── Form primitives ──────────────────────────────────────────────────────

/** Compact inputs for test case create/edit workbench */
export const WORKBENCH_LABEL_CLS =
  "text-xs font-medium leading-snug text-slate-700 dark:text-zinc-300";

export const WORKBENCH_SECTION_TITLE_CLS =
  "text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-300";

export const WORKBENCH_HINT_CLS =
  "text-xs leading-snug text-slate-500 dark:text-zinc-400";

export const WORKBENCH_INPUT_CLS =
  "h-7 min-h-[1.75rem] w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs leading-tight text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const WORKBENCH_SELECT_CLS = `${WORKBENCH_INPUT_CLS} pr-7`;

export const WORKBENCH_TEXTAREA_CLS = `${WORKBENCH_INPUT_CLS} !h-auto min-h-[2.75rem] resize-y py-1 leading-snug`;

export const WORKBENCH_META_CLS = "text-xs font-medium leading-snug text-slate-700 dark:text-zinc-300";

export function WorkbenchField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-px ${className}`}>
      <span className={WORKBENCH_LABEL_CLS}>{label}</span>
      {children}
    </label>
  );
}

export function WorkbenchSection({
  title,
  hint,
  action,
  children,
  tone = "default",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: "default" | "manual" | "automation";
}) {
  const toneCls =
    tone === "automation"
      ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/30"
      : tone === "manual"
        ? "border-slate-200 bg-slate-50/90 dark:border-zinc-600 dark:bg-zinc-800/40"
        : "border-slate-200 bg-slate-50/60 dark:border-zinc-700 dark:bg-zinc-800/40";

  return (
    <section className={`rounded-lg border p-3 ${toneCls}`}>
      {(title || hint || action) && (
        <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            {title ? <div className={WORKBENCH_SECTION_TITLE_CLS}>{title}</div> : null}
            {hint ? <div className={WORKBENCH_HINT_CLS}>{hint}</div> : null}
          </div>
          {action ? <div className="shrink-0 self-end">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

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
  variant = "default",
}: {
  isProjectScoped: boolean;
  scopedProjectName?: string;
  projectId: string;
  projects: Array<{ name?: string } & Record<string, unknown>>;
  onProjectChange: (projectId: string) => void;
  getId: (value: unknown) => string;
  required?: boolean;
  variant?: "default" | "workbench";
}) {
  const isWorkbench = variant === "workbench";
  const LabelWrap = isWorkbench ? WorkbenchField : Field;
  const inputCls = isWorkbench ? WORKBENCH_INPUT_CLS : INPUT_CLS;
  const selectCls = isWorkbench ? WORKBENCH_SELECT_CLS : INPUT_CLS;

  if (isProjectScoped) {
    return (
      <LabelWrap label="Project">
        <input
          className={`${inputCls} ${isWorkbench ? "" : "bg-slate-50 dark:bg-zinc-800/50"}`}
          value={scopedProjectName || "Selected project"}
          readOnly
        />
      </LabelWrap>
    );
  }

  return (
    <LabelWrap label="Project">
      <select
        className={selectCls}
        value={projectId}
        onChange={(event) => onProjectChange(event.target.value)}
        required={required}
      >
        <option value="">{isWorkbench ? "Chọn project" : "Select project"}</option>
        {projects.map((project) => (
          <option key={getId(project)} value={getId(project)}>
            {project.name}
          </option>
        ))}
      </select>
    </LabelWrap>
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
  untested:  "bg-slate-100 text-slate-500 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/40",
  running:   "bg-sky-50 text-sky-700 ring-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30",
  completed: "bg-slate-100 text-slate-700 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600/40",
  pending:   "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30",
  automation:"bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-500/30",
  manual:    "bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/40",
  active:    "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30",
  inactive:  "bg-slate-100 text-slate-500 ring-slate-200/60 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/40",
};

const STATUS_LABELS: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  skip: "Skip",
  untested: "Untested",
  running: "Running",
  completed: "Completed",
  pending: "Pending",
  automation: "Automation",
  manual: "Manual",
  active: "Active",
  inactive: "Inactive",
};

export function getStatusLabel(status: string): string {
  const key = String(status || "").toLowerCase();
  return STATUS_LABELS[key] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const key = String(status || "").toLowerCase();
  const cls = STATUS_STYLES[key] ?? "bg-slate-100 text-slate-600 ring-slate-200/60";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {getStatusLabel(status)}
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

export function useClientPagination<T>(
  items: T[],
  pageSize = DEFAULT_CLIENT_PAGE_SIZE,
  resetKey?: string | number,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const visibleItems = useMemo(() => {
    if (items.length <= pageSize) {
      return items;
    }
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  return {
    visibleItems,
    currentPage: safePage,
    totalPages,
    setCurrentPage,
    pageSize,
    totalItems: items.length,
    hasPagination: items.length > pageSize,
  };
}

type ClientPaginationBarProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ClientPaginationBar({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  className = "",
}: ClientPaginationBarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${className}`.trim()}
    >
      <span>
        {totalItems} items · trang {currentPage}/{totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          ← Trước
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Tiếp →
        </button>
      </div>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyText,
  pageSize = DEFAULT_CLIENT_PAGE_SIZE,
  enablePagination = true,
  getRowProps,
  paginationResetKey,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
  pageSize?: number;
  enablePagination?: boolean;
  getRowProps?: (index: number) => HTMLAttributes<HTMLDivElement>;
  paginationResetKey?: string | number;
}) {
  const pagination = useClientPagination(
    rows,
    pageSize,
    paginationResetKey ?? rows.length,
  );
  const displayRows = enablePagination ? pagination.visibleItems : rows;
  const safePage = enablePagination ? pagination.currentPage : 1;
  const colStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

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
          {displayRows.map((row, i) => {
            const rowIndex = enablePagination ? (safePage - 1) * pageSize + i : i;
            const rowProps = getRowProps?.(rowIndex) || {};
            return (
              <div
                key={i}
                {...rowProps}
                className={`grid items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/70 ${rowProps.className || ""}`}
                style={colStyle}
              >
                {row}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {enablePagination && pagination.hasPagination && (
        <ClientPaginationBar
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setCurrentPage}
        />
      )}
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="tcm-confirm-modal w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
