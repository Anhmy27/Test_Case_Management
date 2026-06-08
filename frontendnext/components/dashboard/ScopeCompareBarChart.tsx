"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartCardClassName, chartHeaderClassName } from "./chartTheme";

export type ScopeCompareItem = {
  id: string;
  name: string;
  progress: number;
  passRate: number;
  totalTests: number;
  detail?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: ScopeCompareItem[];
  emptyText?: string;
  onItemClick?: (item: ScopeCompareItem) => void;
};

function progressBarColor(progress: number, totalTests: number) {
  if (totalTests <= 0) {
    return "#94a3b8";
  }
  if (progress >= 80) {
    return "#10b981";
  }
  if (progress >= 40) {
    return "#f59e0b";
  }
  return "#f43f5e";
}

function truncateLabel(value: string, maxLength = 18) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export default function ScopeCompareBarChart({
  title,
  subtitle,
  items,
  emptyText = "No items to compare",
  onItemClick,
}: Props) {
  const data = items.map((item) => ({
    ...item,
    value: Math.max(0, Math.min(100, Number(item.progress || 0))),
  }));
  const chartHeight = Math.max(160, Math.min(420, data.length * 46 + 32));

  return (
    <section className={chartCardClassName()}>
      <div className={chartHeaderClassName()}>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
      </div>

      {data.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="w-full min-w-0 px-4 pb-4 pt-1" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 52, left: 4, bottom: 4 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(value) => truncateLabel(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.12)", radius: 6 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }
                    const item = payload[0]?.payload as ScopeCompareItem & { value: number };
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {item.detail ? (
                          <div className="mt-0.5 text-slate-500">{item.detail}</div>
                        ) : null}
                        <div className="mt-2 space-y-0.5 text-slate-600">
                          <div>Progress: {item.value}%</div>
                          <div>
                            Pass rate:{" "}
                            {item.totalTests > 0 ? `${Number(item.passRate || 0)}%` : "N/A"}
                          </div>
                          <div>{item.totalTests} tests</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={24}
                  onClick={(_data, index) => {
                    const item = data[index];
                    if (item?.id) {
                      onItemClick?.(item);
                    }
                  }}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={progressBarColor(entry.value, entry.totalTests)}
                      className={onItemClick ? "cursor-pointer" : undefined}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="#475569"
                    fontSize={11}
                    fontWeight={600}
                    formatter={(value) => `${value ?? 0}%`}
                  />
                </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
