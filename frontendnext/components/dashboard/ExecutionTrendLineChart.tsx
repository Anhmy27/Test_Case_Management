"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExecutionTrendPoint } from "./buildExecutionTrend";
import { chartCardClassName, chartHeaderClassName } from "./chartTheme";

type Props = {
  title?: string;
  subtitle?: string;
  points: ExecutionTrendPoint[];
  emptyText?: string;
};

export default function ExecutionTrendLineChart({
  title = "Execution Trend",
  subtitle = "Runs started and result outcomes over the last 14 days",
  points,
  emptyText = "No execution activity in this period",
}: Props) {
  const hasActivity = points.some((point) => point.runs > 0 || point.pass > 0 || point.fail > 0);

  return (
    <section className={chartCardClassName()}>
      <div className={chartHeaderClassName()}>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
      </div>

      {!hasActivity ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="h-[260px] w-full min-w-0 px-2 pb-4 pt-2">
          <ResponsiveContainer width="100%" height={260} minWidth={0}>
            <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [value ?? 0, name ?? ""]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Line
                type="monotone"
                dataKey="runs"
                name="Runs"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="pass"
                name="Pass"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="fail"
                name="Fail"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#f43f5e", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
