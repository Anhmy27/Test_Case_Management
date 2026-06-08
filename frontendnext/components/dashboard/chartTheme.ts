import type { CSSProperties } from "react";
import type { ThemeMode } from "@/components/theme/ThemeProvider";

export const CHART_COLORS = {
  grid: "#e4e4e7",
  gridDark: "#3f3f46",
  axis: "#71717a",
  axisDark: "#a1a1aa",
  runs: "#52525b",
  runsDark: "#d4d4d8",
  muted: "#71717a",
};

export const DASHBOARD_GUTTER = "px-5";

export function dashboardSectionLabelClassName() {
  return "mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400";
}

export function dashboardPanelClassName() {
  return "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] dark:bg-zinc-900 dark:ring-white/[0.08] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.25)]";
}

export function chartSurfaceClassName() {
  return "min-w-0";
}

export function chartHeaderClassName() {
  return "px-5 pt-4 pb-0";
}

export function chartTitleClassName() {
  return "text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100";
}

export function chartSubtitleClassName() {
  return "mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400";
}

export function chartBodyClassName() {
  return "px-5 pb-4 pt-2";
}

export function chartEmptyClassName() {
  return "px-5 py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400";
}

export function chartPlotClassName() {
  return "rounded-lg bg-gradient-to-br from-zinc-200/50 via-zinc-100/70 to-zinc-50/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(0,0,0,0.04)] ring-1 ring-inset ring-black/[0.06] dark:from-zinc-800/80 dark:via-zinc-900/70 dark:to-zinc-950/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.35)] dark:ring-white/[0.06]";
}

export function chartTooltipStyle(theme: ThemeMode = "light"): CSSProperties {
  if (theme === "dark") {
    return {
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
      fontSize: 12,
      backgroundColor: "#27272a",
      color: "#fafafa",
      padding: "8px 12px",
    };
  }
  return {
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    fontSize: 12,
    backgroundColor: "#ffffff",
    padding: "8px 12px",
  };
}

export function dashboardBadgeClassName(variant: "neutral" | "success" | "danger" | "warning" = "neutral") {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums";
  switch (variant) {
    case "success":
      return `${base} text-emerald-700 dark:text-emerald-300`;
    case "danger":
      return `${base} text-rose-700 dark:text-rose-300`;
    case "warning":
      return `${base} text-amber-700 dark:text-amber-300`;
    default:
      return `${base} text-zinc-600 dark:text-zinc-300`;
  }
}

export function dashboardGhostButtonClassName() {
  return "rounded-md px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
}

export function dashboardInputClassName() {
  return "h-8 rounded-md border-0 bg-zinc-100/80 px-3 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:bg-zinc-100 focus:ring-2 focus:ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800 dark:focus:ring-white/10";
}
