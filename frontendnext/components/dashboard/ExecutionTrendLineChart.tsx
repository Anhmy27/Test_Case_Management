"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExecutionTrendPoint } from "./buildExecutionTrend";
import ChartVisualDefs, { chartGradientId } from "./ChartVisualDefs";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  CHART_COLORS,
  chartBodyClassName,
  chartEmptyClassName,
  chartHeaderClassName,
  chartPlotClassName,
  chartSubtitleClassName,
  chartSurfaceClassName,
  chartTitleClassName,
  chartTooltipStyle,
  dashboardPanelClassName,
} from "./chartTheme";

const GRAD_PREFIX = "tcm-trend";

type Props = {
  title?: string;
  subtitle?: string;
  points: ExecutionTrendPoint[];
  emptyText?: string;
  embedded?: boolean;
};

export default function ExecutionTrendLineChart({
  title = "Execution trend",
  subtitle,
  points,
  emptyText = "No activity in the last 14 days",
  embedded = false,
}: Props) {
  const { theme } = useTheme();
  const hasActivity = points.some(
    (point) => point.runs > 0 || point.pass > 0 || point.fail > 0 || point.blocked > 0,
  );
  const outer = embedded ? chartSurfaceClassName() : dashboardPanelClassName();
  const gridColor = theme === "dark" ? CHART_COLORS.gridDark : CHART_COLORS.grid;
  const axisColor = theme === "dark" ? CHART_COLORS.axisDark : CHART_COLORS.axis;
  const runsColor = theme === "dark" ? CHART_COLORS.runsDark : CHART_COLORS.runs;

  return (
    <section className={outer}>
      <div className={chartHeaderClassName()}>
        <div className={chartTitleClassName()}>{title}</div>
        {subtitle ? <div className={chartSubtitleClassName()}>{subtitle}</div> : null}
      </div>

      {!hasActivity ? (
        <div className={chartEmptyClassName()}>{emptyText}</div>
      ) : (
        <div className={chartBodyClassName()}>
          <div className={`${chartPlotClassName()} h-[196px] w-full min-w-0`}>
            <ResponsiveContainer width="100%" height={188} minWidth={0}>
              <ComposedChart data={points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <ChartVisualDefs prefix={GRAD_PREFIX} sets={["trend"]} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: axisColor, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle(theme)}
                  formatter={(value, name) => [value ?? 0, name ?? ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px", color: axisColor }} iconSize={10} />
                <Area
                  type="monotone"
                  dataKey="runs"
                  name="Runs"
                  stroke={runsColor}
                  strokeWidth={2.25}
                  fill={chartGradientId(GRAD_PREFIX, "trend-runs")}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: runsColor }}
                />
                <Area
                  type="monotone"
                  dataKey="pass"
                  name="Pass"
                  stroke="#16a34a"
                  strokeWidth={2.25}
                  fill={chartGradientId(GRAD_PREFIX, "trend-pass")}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#16a34a" }}
                />
                <Area
                  type="monotone"
                  dataKey="fail"
                  name="Fail"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fill={chartGradientId(GRAD_PREFIX, "trend-fail")}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#dc2626" }}
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  name="Blocked"
                  stroke="#d97706"
                  strokeWidth={2}
                  fill={chartGradientId(GRAD_PREFIX, "trend-blocked")}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#d97706" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
