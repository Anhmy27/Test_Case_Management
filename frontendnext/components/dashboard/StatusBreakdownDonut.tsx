"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type StatusBreakdownItem = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: StatusBreakdownItem[];
};

export default function StatusBreakdownDonut({
  title,
  subtitle,
  items,
}: Props) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const chartItems = items.filter((item) => item.value > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative mx-auto h-64 w-64 min-h-[220px] min-w-[220px]">
          <ResponsiveContainer width={256} height={256}>
            <PieChart>
              <Pie
                data={chartItems}
                dataKey="value"
                nameKey="label"
                innerRadius={74}
                outerRadius={104}
                paddingAngle={3}
                stroke="none"
              >
                {chartItems.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-semibold text-slate-900">
                {total}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total items
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div
                key={item.key}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {item.value}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
