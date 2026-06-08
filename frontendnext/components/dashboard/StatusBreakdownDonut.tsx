"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { STATUS_GRADIENTS, chartCardClassName, chartHeaderClassName } from "./chartTheme";

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

function getGradient(item: StatusBreakdownItem) {
  const preset = STATUS_GRADIENTS[item.key];
  if (preset) {
    return preset;
  }
  return {
    from: item.gradientFrom || item.color,
    to: item.gradientTo || item.color,
    soft: "#f8fafc",
  };
}

export default function StatusBreakdownDonut({ title, subtitle, items }: Props) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const chartItems = items.filter((item) => item.value > 0);

  return (
    <section className={chartCardClassName()}>
      <div className={chartHeaderClassName()}>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
      </div>

      <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="relative mx-auto h-[220px] w-[220px] shrink-0 lg:mx-0">
          <PieChart width={220} height={220}>
            <defs>
              {items.map((item) => {
                const gradient = getGradient(item);
                return (
                  <linearGradient key={item.key} id={`donut-${item.key}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={gradient.from} />
                    <stop offset="100%" stopColor={gradient.to} />
                  </linearGradient>
                );
              })}
            </defs>
            <Pie
              data={
                chartItems.length > 0
                  ? chartItems
                  : [{ key: "empty", label: "No data", value: 1 }]
              }
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={chartItems.length > 0 ? 3 : 0}
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
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                fontSize: "12px",
              }}
            />
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{total}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Total
              </div>
            </div>
          </div>
        </div>

        <ul className="grid w-full min-w-0 flex-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const gradient = getGradient(item);
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {item.label}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {item.value}
                </span>
                <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
                  {percentage.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
