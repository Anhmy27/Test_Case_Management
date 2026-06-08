"use client";

import type { ReactNode } from "react";
import { DASHBOARD_GUTTER } from "./chartTheme";

export type DashboardKpiItem = {
  id: string;
  label: string;
  value: ReactNode;
  helper?: string;
  hint?: string;
};

type Props = {
  items: DashboardKpiItem[];
  className?: string;
};

function resolveItemKey(item: DashboardKpiItem, index: number): string {
  const id = String(item.id || "").trim();
  if (id) {
    return id;
  }
  const label = String(item.label || "").trim();
  if (label) {
    return `kpi-${label.toLowerCase().replace(/\s+/g, "-")}`;
  }
  return `kpi-${index}`;
}

export default function DashboardKpiRow({ items, className = "" }: Props) {
  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid grid-cols-2 gap-x-5 gap-y-3 border-b border-black/[0.05] pb-4 dark:border-white/[0.06] xl:grid-cols-4 ${DASHBOARD_GUTTER} ${className}`}
    >
      {safeItems.map((item, index) => (
        <article key={resolveItemKey(item, index)} title={item.hint || item.helper}>
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {item.label}
          </div>
          <div className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
            {item.value}
          </div>
        </article>
      ))}
    </div>
  );
}
