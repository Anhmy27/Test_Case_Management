export const STATUS_GRADIENTS: Record<string, { from: string; to: string; soft: string }> = {
  pass: { from: "#34d399", to: "#059669", soft: "#ecfdf5" },
  fail: { from: "#fb7185", to: "#e11d48", soft: "#fff1f2" },
  blocked: { from: "#fbbf24", to: "#d97706", soft: "#fffbeb" },
  untested: { from: "#818cf8", to: "#6366f1", soft: "#eef2ff" },
};

export function chartCardClassName() {
  return "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";
}

export function chartHeaderClassName() {
  return "border-b border-slate-100 px-5 py-4";
}
