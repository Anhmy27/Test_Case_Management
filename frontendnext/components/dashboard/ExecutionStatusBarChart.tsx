"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusBreakdownItem } from "./StatusBreakdownDonut";

type Props = {
  title: string;
  subtitle?: string;
  items: StatusBreakdownItem[];
};

const BAR_GRADIENTS = [
  { id: "bar-pass", from: "#34d399", to: "#059669" },
  { id: "bar-fail", from: "#fb7185", to: "#e11d48" },
  { id: "bar-blocked", from: "#fbbf24", to: "#d97706" },
  { id: "bar-untested", from: "#818cf8", to: "#4f46e5" },
];

export default function ExecutionStatusBarChart({ title, subtitle, items }: Props) {
  const data = items.map((item, index) => ({
    ...item,
    gradientId: BAR_GRADIENTS[index % BAR_GRADIENTS.length]?.id ?? "bar-pass",
  }));

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/50 shadow-sm">
      <div className="border-b border-violet-100/80 px-6 py-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
      <div className="h-[288px] w-full min-w-0 px-4 pb-4">
        <ResponsiveContainer width="100%" height={288} minWidth={0}>
          <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {BAR_GRADIENTS.map((gradient) => (
                <linearGradient key={gradient.id} id={gradient.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradient.from} />
                  <stop offset="100%" stopColor={gradient.to} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e9d5ff" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #ddd6fe",
                boxShadow: "0 12px 32px rgba(91, 33, 182, 0.15)",
              }}
            />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={56}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={`url(#${entry.gradientId})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
