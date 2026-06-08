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
import ChartVisualDefs, { chartGradientId } from "./ChartVisualDefs";
import {
  CHART_COLORS,
  chartBodyClassName,
  chartEmptyClassName,
  chartHeaderClassName,
  chartPlotClassName,
  chartSubtitleClassName,
  chartSurfaceClassName,
  chartTitleClassName,
  dashboardPanelClassName,
} from "./chartTheme";
import { truncateChartLabel } from "./chartUtils";

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
  embedded?: boolean;
  onItemClick?: (item: ScopeCompareItem) => void;
};

const GRAD_PREFIX = "tcm-prog";

function progressBarFill(progress: number, totalTests: number) {
  if (totalTests <= 0) {
    return chartGradientId(GRAD_PREFIX, "prog-empty");
  }
  if (progress >= 80) {
    return chartGradientId(GRAD_PREFIX, "prog-high");
  }
  if (progress >= 40) {
    return chartGradientId(GRAD_PREFIX, "prog-mid");
  }
  return chartGradientId(GRAD_PREFIX, "prog-low");
}

export default function ScopeCompareBarChart({
  title,
  subtitle,
  items,
  emptyText = "No items to compare",
  embedded = false,
  onItemClick,
}: Props) {
  const data = items.map((item) => ({
    ...item,
    value: Math.max(0, Math.min(100, Number(item.progress || 0))),
  }));
  const chartHeight = Math.max(140, Math.min(360, data.length * 38 + 28));
  const outer = embedded ? chartSurfaceClassName() : dashboardPanelClassName();

  return (
    <section className={outer}>
      <div className={chartHeaderClassName()}>
        <div className={chartTitleClassName()}>{title}</div>
        {subtitle ? <div className={chartSubtitleClassName()}>{subtitle}</div> : null}
      </div>

      {data.length === 0 ? (
        <div className={chartEmptyClassName()}>{emptyText}</div>
      ) : (
        <div className={chartBodyClassName()}>
          <div className={`${chartPlotClassName()} w-full min-w-0`} style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight - 8} minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 2, right: 48, left: 0, bottom: 2 }}
              >
                <ChartVisualDefs prefix={GRAD_PREFIX} sets={["progressBar", "failBar"]} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: CHART_COLORS.muted, fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(value) => truncateChartLabel(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }
                    const item = payload[0]?.payload as ScopeCompareItem & { value: number };
                    return (
                      <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
                        <div className="font-medium text-zinc-900">{item.name}</div>
                        {item.detail ? (
                          <div className="mt-0.5 text-zinc-500">{item.detail}</div>
                        ) : null}
                        <div className="mt-2 space-y-0.5 text-zinc-600">
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
                  radius={[0, 5, 5, 0]}
                  maxBarSize={16}
                  background={{ fill: chartGradientId(GRAD_PREFIX, "bar-track"), radius: 5 }}
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
                      fill={progressBarFill(entry.value, entry.totalTests)}
                      className={onItemClick ? "cursor-pointer" : undefined}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill={CHART_COLORS.muted}
                    fontSize={10}
                    fontWeight={600}
                    formatter={(value) => `${value ?? 0}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
