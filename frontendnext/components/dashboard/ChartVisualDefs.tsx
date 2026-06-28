"use client";

type GradientSet = "trend" | "failBar" | "progressBar";

type Props = {
  prefix?: string;
  sets?: GradientSet[];
};

/** SVG gradient defs shared by Recharts dashboard widgets */
export default function ChartVisualDefs({
  prefix = "tcm",
  sets = ["trend", "failBar", "progressBar"],
}: Props) {
  const id = (name: string) => `${prefix}-${name}`;
  const show = (set: GradientSet) => sets.includes(set);

  return (
    <defs>
      {show("trend") ? (
        <>
          <linearGradient id={id("trend-pass")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={id("trend-fail")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={id("trend-runs")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#52525b" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={id("trend-blocked")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0.04} />
          </linearGradient>
        </>
      ) : null}

      {show("failBar") ? (
        <>
          <linearGradient id={id("fail-high")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fecaca" />
            <stop offset="45%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id={id("fail-mid")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fee2e2" />
            <stop offset="50%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id={id("fail-low")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fef2f2" />
            <stop offset="50%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id={id("bar-track")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="100%" stopColor="#e4e4e7" />
          </linearGradient>
        </>
      ) : null}

      {show("progressBar") ? (
        <>
          <linearGradient id={id("prog-high")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id={id("prog-mid")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e4e4e7" />
            <stop offset="50%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#71717a" />
          </linearGradient>
          <linearGradient id={id("prog-low")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="50%" stopColor="#d4d4d8" />
            <stop offset="100%" stopColor="#52525b" />
          </linearGradient>
          <linearGradient id={id("prog-empty")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#d4d4d8" />
          </linearGradient>
        </>
      ) : null}
    </defs>
  );
}

export function chartGradientId(prefix: string, name: string) {
  return `url(#${prefix}-${name})`;
}
