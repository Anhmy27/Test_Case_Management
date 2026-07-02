"use client";

import { useId, useMemo } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  chartBodyClassName,
  chartHeaderClassName,
  chartSurfaceClassName,
  chartTitleClassName,
  dashboardBadgeClassName,
  dashboardPanelClassName,
} from "./chartTheme";

export type StatusBreakdownItem = {
  key: string;
  label: string;
  value: number;
};

type Props = {
  title: string;
  subtitle?: string;
  items: StatusBreakdownItem[];
  embedded?: boolean;
};

const SEGMENT_STYLE: Record<
  string,
  { top: string; mid: string; side: string; glow: string }
> = {
  pass: { top: "#4ade80", mid: "#22c55e", side: "#166534", glow: "#86efac" },
  fail: { top: "#fb7185", mid: "#ef4444", side: "#991b1b", glow: "#fecdd3" },
  blocked: { top: "#fcd34d", mid: "#f59e0b", side: "#b45309", glow: "#fde68a" },
  skip: { top: "#cbd5e1", mid: "#94a3b8", side: "#475569", glow: "#e2e8f0" },
  untested: { top: "#e4e4e7", mid: "#d4d4d8", side: "#71717a", glow: "#f4f4f5" },
};

const CX = 128;
const CY = 118;
const DEPTH = 14;
const INNER = 72;
const OUTER = 112;
const SVG_W = 256;
const SVG_H = 248;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  if (endAngle - startAngle >= 359.99) {
    endAngle = startAngle + 359.99;
  }
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const oStart = polar(cx, cy, outerR, startAngle);
  const oEnd = polar(cx, cy, outerR, endAngle);
  const iEnd = polar(cx, cy, innerR, endAngle);
  const iStart = polar(cx, cy, innerR, startAngle);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

function sideWallPath(
  cx: number,
  cy: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  depth: number,
) {
  if (endAngle - startAngle >= 359.99) {
    return "";
  }
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const topStart = polar(cx, cy, outerR, startAngle);
  const topEnd = polar(cx, cy, outerR, endAngle);
  const botEnd = polar(cx, cy + depth, outerR, endAngle);
  const botStart = polar(cx, cy + depth, outerR, startAngle);
  return [
    `M ${topStart.x} ${topStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${topEnd.x} ${topEnd.y}`,
    `L ${botEnd.x} ${botEnd.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${botStart.x} ${botStart.y}`,
    "Z",
  ].join(" ");
}

type RenderSegment = {
  key: string;
  label: string;
  value: number;
  startAngle: number;
  endAngle: number;
};

function Donut3DChart({
  segments,
  total,
  uid,
  isDark,
}: {
  segments: RenderSegment[];
  total: number;
  uid: string;
  isDark: boolean;
}) {
  const id = (name: string) => `${uid}-${name}`;
  const innerTop = isDark ? "#3f3f46" : "#ffffff";
  const innerMid = isDark ? "#27272a" : "#f4f4f5";
  const innerBottom = isDark ? "#18181b" : "#d4d4d8";
  const centerText = isDark ? "#fafafa" : "#18181b";
  const centerMuted = isDark ? "#71717a" : "#a1a1aa";
  const segmentStroke = isDark ? "#18181b" : "#ffffff";

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="block h-auto w-full max-w-[256px] shrink-0"
      role="img"
      aria-label={`Status breakdown, ${total} results`}
    >
      <defs>
        {segments.map((seg) => {
          const style = SEGMENT_STYLE[seg.key] || SEGMENT_STYLE.untested;
          return (
            <radialGradient
              key={seg.key}
              id={id(`top-${seg.key}`)}
              cx="35%"
              cy="28%"
              r="75%"
            >
              <stop offset="0%" stopColor={style.glow} />
              <stop offset="45%" stopColor={style.top} />
              <stop offset="100%" stopColor={style.side} />
            </radialGradient>
          );
        })}
        <linearGradient id={id("inner-bevel")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={innerTop} />
          <stop offset="55%" stopColor={innerMid} />
          <stop offset="100%" stopColor={innerBottom} />
        </linearGradient>
        <linearGradient id={id("inner-shadow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.06)"} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id={id("chart-shadow")} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity={isDark ? 0.45 : 0.16} />
        </filter>
      </defs>

      <ellipse
        cx={CX}
        cy={CY + OUTER + 4}
        rx={OUTER * 0.74}
        ry={8}
        fill={isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.08)"}
      />

      <g filter={`url(#${id("chart-shadow")})`}>
        {segments.map((seg) => {
          const style = SEGMENT_STYLE[seg.key] || SEGMENT_STYLE.untested;
          const wall = sideWallPath(CX, CY, OUTER, seg.startAngle, seg.endAngle, DEPTH);
          if (!wall) {
            return null;
          }
          return <path key={`wall-${seg.key}`} d={wall} fill={style.side} opacity={0.92} />;
        })}

        {segments.map((seg) => (
          <path
            key={`depth-${seg.key}`}
            d={donutSegmentPath(CX, CY + DEPTH * 0.55, INNER, OUTER, seg.startAngle, seg.endAngle)}
            fill={SEGMENT_STYLE[seg.key]?.side || SEGMENT_STYLE.untested.side}
            opacity={0.55}
          />
        ))}

        {segments.map((seg) => (
          <path
            key={`top-${seg.key}`}
            d={donutSegmentPath(CX, CY, INNER, OUTER, seg.startAngle, seg.endAngle)}
            fill={`url(#${id(`top-${seg.key}`)})`}
            stroke={segmentStroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ))}
      </g>

      <circle cx={CX} cy={CY} r={INNER - 1} fill={`url(#${id("inner-bevel")})`} />
      <circle
        cx={CX}
        cy={CY}
        r={INNER - 1}
        fill={`url(#${id("inner-shadow")})`}
        pointerEvents="none"
      />
      <circle
        cx={CX}
        cy={CY - 1}
        r={INNER - 3}
        fill="none"
        stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.65)"}
        strokeWidth={1}
        pointerEvents="none"
      />

      <text
        x={CX}
        y={CY - 2}
        textAnchor="middle"
        fill={centerText}
        style={{ fontSize: 30, fontWeight: 700 }}
      >
        {total}
      </text>
      <text
        x={CX}
        y={CY + 16}
        textAnchor="middle"
        fill={centerMuted}
        style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em" }}
      >
        RESULTS
      </text>
    </svg>
  );
}

export default function StatusBreakdownDonut({ title, subtitle, items, embedded = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const outer = embedded ? chartSurfaceClassName() : dashboardPanelClassName();

  const segments = useMemo(() => {
    const positive = items.filter((item) => item.value > 0);
    if (positive.length === 0) {
      return [];
    }
    let cursor = 0;
    const gap = positive.length > 1 ? 2.2 : 0;
    return positive.map((item) => {
      const sweep = (item.value / total) * (360 - gap * positive.length);
      const startAngle = cursor + gap / 2;
      const endAngle = startAngle + sweep;
      cursor = endAngle + gap / 2;
      return {
        key: item.key,
        label: item.label,
        value: item.value,
        startAngle,
        endAngle,
      };
    });
  }, [items, total]);

  return (
    <section className={`${outer} flex h-full min-h-0 flex-col`}>
      <div
        className={`${chartHeaderClassName()} flex min-h-[52px] shrink-0 items-center justify-between gap-3`}
      >
        <div className={chartTitleClassName()}>{title}</div>
        <span className={dashboardBadgeClassName("neutral")}>{total} total</span>
      </div>
      {!embedded && subtitle ? (
        <p className="-mt-2 px-5 pb-0 text-[11px] text-zinc-400 dark:text-zinc-500">{subtitle}</p>
      ) : null}

      <div
        className={`${chartBodyClassName()} flex items-center justify-start gap-4 pb-3 pt-0 sm:gap-5`}
      >
        <div className="shrink-0">
          {segments.length > 0 ? (
            <Donut3DChart segments={segments} total={total} uid={uid} isDark={isDark} />
          ) : (
            <div
              className="flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"
              style={{ width: SVG_W, height: SVG_H }}
            >
              <span className="text-[13px] text-zinc-400 dark:text-zinc-500">No data</span>
            </div>
          )}
        </div>

        <ul className="min-w-[168px] shrink-0">
          {items.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            const style = SEGMENT_STYLE[item.key] || SEGMENT_STYLE.untested;
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 border-b border-black/[0.04] py-2 last:border-0 dark:border-white/[0.06]"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-[4px] shadow-sm"
                  style={{
                    background: `linear-gradient(145deg, ${style.glow}, ${style.side})`,
                  }}
                />
                <span className="min-w-[4.5rem] shrink-0 text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                  {item.label}
                </span>
                <span className="text-[15px] font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {item.value}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                  {percentage.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
