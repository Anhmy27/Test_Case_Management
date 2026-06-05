"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TesterRow = {
  name: string;
  passCount: number;
  failCount: number;
  blockedCount?: number;
};

type Props = {
  rows: TesterRow[];
};

export default function TesterThroughputChart({ rows }: Props) {
  if (rows.length === 0) {
    return null;
  }

  const data = rows.slice(0, 6).map((row) => ({
    name: row.name.split(" ")[0] || row.name,
    Pass: row.passCount,
    Fail: row.failCount,
    Blocked: row.blockedCount || 0,
  }));

  return (
    <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 via-white to-sky-50/60 p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">Throughput chart</div>
        <div className="text-xs text-slate-500">Pass / fail / blocked by tester</div>
      </div>
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height={224} minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#bae6fd" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis
              type="category"
              dataKey="name"
              width={72}
              tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #a5f3fc",
                boxShadow: "0 10px 28px rgba(14, 116, 144, 0.12)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="Pass" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Fail" stackId="a" fill="#f43f5e" />
            <Bar dataKey="Blocked" stackId="a" fill="#f59e0b" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
