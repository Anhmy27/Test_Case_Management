"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";

export type StatusBreakdownItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  gradientFrom?: string;
  gradientTo?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: StatusBreakdownItem[];
};

const DEFAULT_GRADIENTS: Record<string, { from: string; to: string }> = {
  pass: { from: "#6ee7b7", to: "#059669" },
  fail: { from: "#fda4af", to: "#e11d48" },
  blocked: { from: "#fcd34d", to: "#d97706" },
  untested: { from: "#a5b4fc", to: "#4f46e5" },
};

export default function StatusBreakdownDonut({
  title,
  subtitle,
  items,
}: Props) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const chartItems = items.filter((item) => item.value > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 shadow-sm">
      <div className="border-b border-indigo-100/80 px-6 py-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>

      <div className="grid min-w-0 gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative mx-auto h-64 w-64 shrink-0">
          <PieChart width={256} height={256}>
              <defs>
                {items.map((item) => {
                  const gradient = DEFAULT_GRADIENTS[item.key] || {
                    from: item.gradientFrom || item.color,
                    to: item.gradientTo || item.color,
                  };
                  return (
                    <linearGradient key={item.key} id={`donut-${item.key}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={gradient.from} />
                      <stop offset="100%" stopColor={gradient.to} />
                    </linearGradient>
                  );
                })}
              </defs>
              <Pie
                data={chartItems.length > 0 ? chartItems : [{ key: "empty", label: "No data", value: 1 }]}
                dataKey="value"
                nameKey="label"
                innerRadius={68}
                outerRadius={102}
                paddingAngle={chartItems.length > 0 ? 4 : 0}
                stroke="#fff"
                strokeWidth={2}
              >
                {chartItems.length > 0 ? (
                  chartItems.map((entry) => (
                    <Cell key={entry.key} fill={`url(#donut-${entry.key})`} />
                  ))
                ) : (
                  <Cell fill="#e2e8f0" />
                )}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value ?? 0, name ?? ""]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #c7d2fe",
                  boxShadow: "0 12px 32px rgba(79, 70, 229, 0.15)",
                }}
              />
            </PieChart>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/90 px-4 py-3 text-center shadow-sm ring-1 ring-indigo-100">
              <div className="text-3xl font-bold text-indigo-950">{total}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
                Total items
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            const gradient = DEFAULT_GRADIENTS[item.key] || { from: item.color, to: item.color };
            return (
              <div
                key={item.key}
                className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                    />
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{item.value}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                    }}
                  />
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
