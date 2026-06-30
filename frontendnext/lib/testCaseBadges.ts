const PRIORITY_BADGE_BASE =
  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize";

export function priorityBadgeClass(priority?: string | null): string {
  switch (String(priority || "medium").trim().toLowerCase()) {
    case "low":
      return `${PRIORITY_BADGE_BASE} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`;
    case "medium":
      return `${PRIORITY_BADGE_BASE} bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300`;
    case "high":
      return `${PRIORITY_BADGE_BASE} bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300`;
    case "critical":
      return `${PRIORITY_BADGE_BASE} bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300`;
    default:
      return `${PRIORITY_BADGE_BASE} bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300`;
  }
}
