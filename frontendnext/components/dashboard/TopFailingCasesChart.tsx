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
import { chartCardClassName, chartHeaderClassName } from "./chartTheme";

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
  onItemClick?: (item: TopFailingCaseItem) => void;
};

const DEFAULT_MAX_ITEMS = 8;

function truncateLabel(value: string, maxLength = 20) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function failBarColor(failCount: number, maxFailCount: number) {
  if (failCount <= 0) {
    return "#94a3b8";
  }
  const ratio = maxFailCount > 0 ? failCount / maxFailCount : 0;
  if (ratio >= 0.66) {
    return "#e11d48";
  }
  if (ratio >= 0.33) {
    return "#f43f5e";
  }
  return "#fb7185";
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
  const chartHeight = Math.max(120, data.length * 34 + 24);

  return (
    <div className="w-full min-w-0 px-4 pb-4 pt-1" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, Math.max(maxFailCount, 1)]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }}
            tickFormatter={(value) => truncateLabel(String(value))}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(244, 63, 94, 0.08)", radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }
              const item = payload[0]?.payload as ChartRow;
              return (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold text-slate-900">{item.caseKey || item.label}</div>
                  <div className="mt-0.5 text-slate-600">{item.title}</div>
                  {showProject && item.projectName ? (
                    <div className="mt-0.5 text-slate-500">{item.projectName}</div>
                  ) : null}
                  <div className="mt-2 font-semibold text-rose-700">
                    {item.value} fail{item.value === 1 ? "" : "s"} · Click to open
                  </div>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            maxBarSize={20}
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
                fill={failBarColor(entry.value, maxFailCount)}
                className={onItemClick ? "cursor-pointer" : undefined}
              />
            ))}
            <LabelList dataKey="value" position="right" fill="#be123c" fontSize={11} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TopFailingCasesChart({
  title = "Top Failing Cases",
  subtitle = "Sorted by fail count — click a bar to open the test case",
  items,
  showProject = true,
  emptyText = "No failing cases found",
  maxItems = DEFAULT_MAX_ITEMS,
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

  return (
    <>
      <section className={chartCardClassName()}>
        <div className={chartHeaderClassName()}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold text-slate-900">{title}</div>
              {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
            </div>
            {previewData.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  Top {previewData.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllModal(true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  View all
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {previewData.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</div>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowAllModal(false)}
        >
          <div
            className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">All failing cases</div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {allData.length} case{allData.length === 1 ? "" : "s"} · highest fail count first
                  {hasMoreThanPreview ? ` · showing all (not just top ${maxItems})` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
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
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-rose-50/70"
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
