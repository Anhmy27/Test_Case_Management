"use client";

import { Cell, Pie, PieChart } from "recharts";

type Props = {
  passRate: number;
  label?: string;
};

export default function PassRateRadial({ passRate, label = "Pass rate" }: Props) {
  const safeRate = Math.max(0, Math.min(100, passRate));
  const data = [
    { name: "pass", value: safeRate },
    { name: "rest", value: 100 - safeRate },
  ];

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/90 to-white p-4 shadow-sm">
      <div className="relative h-36 w-36 shrink-0">
        <PieChart width={144} height={144}>
            <defs>
              <linearGradient id="passRateGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <Pie
              data={data}
              dataKey="value"
              startAngle={210}
              endAngle={-30}
              innerRadius={46}
              outerRadius={62}
              stroke="none"
              paddingAngle={0}
            >
              <Cell fill="url(#passRateGradient)" />
              <Cell fill="#e2e8f0" />
            </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
          <div className="text-2xl font-bold text-emerald-700">{safeRate}%</div>
        </div>
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
