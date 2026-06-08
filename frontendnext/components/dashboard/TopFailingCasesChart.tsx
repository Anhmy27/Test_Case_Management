"use client";

import { useMemo, useState } from "react";
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
  dashboardBadgeClassName,
  dashboardGhostButtonClassName,
  dashboardPanelClassName,
} from "./chartTheme";
import { truncateChartLabel } from "./chartUtils";

export type TopFailingCaseItem = {
  id: string;
  caseKey: string;
  title: string;
  failCount: number;
  projectId?: string;
  projectName?: string;
  priority?: string;
};

type ChartRow = TopFailingCaseItem & {
  label: string;
  value: number;
};

type Props = {
  title?: string;
  subtitle?: string;
  items: TopFailingCaseItem[];
  showProject?: boolean;
  emptyText?: string;
  maxItems?: number;
  embedded?: boolean;
  onItemClick?: (item: TopFailingCaseItem) => void;
};

const DEFAULT_MAX_ITEMS = 8;
const GRAD_PREFIX = "tcm-fail";

function failBarFill(failCount: number, maxFailCount: number) {
  if (failCount <= 0) {
    return chartGradientId(GRAD_PREFIX, "bar-track");
  }
  const ratio = maxFailCount > 0 ? failCount / maxFailCount : 0;
  if (ratio >= 0.66) {
    return chartGradientId(GRAD_PREFIX, "fail-high");
  }
  if (ratio >= 0.33) {
    return chartGradientId(GRAD_PREFIX, "fail-mid");
  }
  return chartGradientId(GRAD_PREFIX, "fail-low");
}

function normalizeRows(items: TopFailingCaseItem[]): ChartRow[] {
  return items
    .map((item) => ({
      ...item,
      label: item.caseKey || item.title,
      value: Math.max(0, Number(item.failCount || 0)),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function FailingCasesBarChart({
  data,
  maxFailCount,
  showProject,
  onItemClick,
}: {
  data: ChartRow[];
  maxFailCount: number;
  showProject: boolean;
  onItemClick?: (item: TopFailingCaseItem) => void;
}) {
  const chartHeight = Math.max(100, data.length * 32 + 20);

  return (
    <div className={`${chartBodyClassName()} w-full min-w-0 pt-0`}>
      <div className={`${chartPlotClassName()} w-full min-w-0`} style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height={chartHeight - 8} minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
            <ChartVisualDefs prefix={GRAD_PREFIX} sets={["failBar"]} />
          <XAxis type="number" domain={[0, Math.max(maxFailCount, 1)]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tick={{ fill: CHART_COLORS.muted, fontSize: 12, fontWeight: 500 }}
            tickFormatter={(value) => truncateChartLabel(String(value), 20)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(239,68,68,0.06)", radius: 4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }
              const item = payload[0]?.payload as ChartRow;
              return (
                <div className="rounded-md border border-black/[0.08] bg-white px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                  <div className="font-medium text-zinc-900">{item.caseKey || item.label}</div>
                  <div className="mt-0.5 text-zinc-600">{item.title}</div>
                  {showProject && item.projectName ? (
                    <div className="mt-0.5 text-zinc-500">{item.projectName}</div>
                  ) : null}
                  <div className="mt-2 font-medium text-rose-600">
                    {item.value} fail{item.value === 1 ? "" : "s"} · Click to open
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
                fill={failBarFill(entry.value, maxFailCount)}
                className={onItemClick ? "cursor-pointer" : undefined}
              />
            ))}
            <LabelList dataKey="value" position="right" fill={CHART_COLORS.muted} fontSize={10} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function TopFailingCasesChart({
  title = "Top failing cases",
  subtitle = "Click a bar to open the test case",
  items,
  showProject = true,
  emptyText = "No failing cases found",
  maxItems = DEFAULT_MAX_ITEMS,
  embedded = false,
  onItemClick,
}: Props) {
  const [showAllModal, setShowAllModal] = useState(false);

  const allData = useMemo(() => normalizeRows(items), [items]);
  const previewData = useMemo(() => allData.slice(0, maxItems), [allData, maxItems]);
  const previewMaxFailCount = previewData.reduce((max, item) => Math.max(max, item.value), 0);
  const allMaxFailCount = allData.reduce((max, item) => Math.max(max, item.value), 0);
  const hasMoreThanPreview = allData.length > previewData.length;

  const handleItemClick = (item: TopFailingCaseItem) => {
    setShowAllModal(false);
    onItemClick?.(item);
  };
  const outer = embedded ? chartSurfaceClassName() : dashboardPanelClassName();

  return (
    <>
      <section className={outer}>
        <div className={chartHeaderClassName()}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className={chartTitleClassName()}>{title}</div>
              {subtitle ? <div className={chartSubtitleClassName()}>{subtitle}</div> : null}
            </div>
            {previewData.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className={dashboardBadgeClassName("neutral")}>{previewData.length} shown</span>
                <button
                  type="button"
                  onClick={() => setShowAllModal(true)}
                  className={dashboardGhostButtonClassName()}
                >
                  View all
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {previewData.length === 0 ? (
          <div className={chartEmptyClassName()}>{emptyText}</div>
        ) : (
          <FailingCasesBarChart
            data={previewData}
            maxFailCount={previewMaxFailCount}
            showProject={showProject}
            onItemClick={handleItemClick}
          />
        )}
      </section>

      {showAllModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setShowAllModal(false)}
        >
          <div
            className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-[0_24px_48px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
              <div>
                <div className={chartTitleClassName()}>All failing cases</div>
                <div className={chartSubtitleClassName()}>
                  {allData.length} case{allData.length === 1 ? "" : "s"} · highest fail count first
                  {hasMoreThanPreview ? ` · showing all (not just top ${maxItems})` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className={dashboardGhostButtonClassName()}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <ul className="space-y-1">
                {allData.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
                    >
                      <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {item.caseKey || "—"}
                          </span>
                          <span className="truncate text-sm text-slate-600">{item.title}</span>
                        </div>
                        {showProject && item.projectName ? (
                          <div className="mt-0.5 truncate text-xs text-slate-500">{item.projectName}</div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block">
                          <div
                            className="h-full rounded-full bg-rose-500"
                            style={{
                              width: `${allMaxFailCount > 0 ? (item.value / allMaxFailCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="min-w-[3rem] rounded-full bg-rose-100 px-2 py-0.5 text-right text-xs font-semibold tabular-nums text-rose-700">
                          {item.value}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
