"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { ChartPoint } from "@/types/app";

export function RevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `R$ ${Math.round(value / 1000)}k`}
            tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{
              background: "rgba(15,23,42,0.96)",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f8fafc",
            }}
          />
          <Area
            type="monotone"
            dataKey="receitas"
            stroke="#34d399"
            fill="url(#incomeGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="#fb7185"
            fill="url(#expenseGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
