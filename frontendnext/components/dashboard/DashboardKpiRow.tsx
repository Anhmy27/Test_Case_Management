"use client";

import type { ReactNode } from "react";

export type DashboardKpiItem = {
  id: string;
  label: string;
  value: ReactNode;
  helper?: string;
  hint?: string;
  accent: "indigo" | "sky" | "emerald" | "amber" | "rose";
};

type Props = {
  items: DashboardKpiItem[];
};

const accentStyles: Record<DashboardKpiItem["accent"], string> = {
  indigo: "border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white",
  sky: "border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-white",
  emerald: "border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white",
  amber: "border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-white",
  rose: "border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-white",
};

const valueStyles: Record<DashboardKpiItem["accent"], string> = {
  indigo: "text-indigo-950",
  sky: "text-sky-950",
  emerald: "text-emerald-800",
  amber: "text-amber-800",
  rose: "text-rose-800",
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

export default function DashboardKpiRow({ items }: Props) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {safeItems.map((item, index) => (
        <article
          key={resolveItemKey(item, index)}
          className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${accentStyles[item.accent]}`}
          title={item.hint}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </div>
            {item.hint ? (
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-400"
                aria-label={item.hint}
              >
                i
              </span>
            ) : null}
          </div>
          <div className={`mt-3 text-3xl font-semibold tracking-tight ${valueStyles[item.accent]}`}>
            {item.value}
          </div>
          {item.helper ? <div className="mt-2 text-sm text-slate-500">{item.helper}</div> : null}
        </article>
      ))}
    </div>
  );
}
