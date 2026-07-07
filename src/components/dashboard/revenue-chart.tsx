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
              <stop offset="5%" stopColor="#8aa17c" stopOpacity={0.42} />
              <stop offset="95%" stopColor="#8aa17c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#b46c5d" stopOpacity={0.34} />
              <stop offset="95%" stopColor="#b46c5d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(245,241,232,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(245,241,232,0.66)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => value >= 1000 ? `R$${Math.round(value / 1000)}k` : `R$${value}`}
            tick={{ fill: "rgba(245,241,232,0.52)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{
              background: "rgba(17,22,20,0.96)",
              borderRadius: "16px",
              border: "1px solid rgba(245,241,232,0.1)",
              color: "#f5f1e8",
            }}
          />
          <Area
            type="monotone"
            dataKey="receitas"
            stroke="#8aa17c"
            fill="url(#incomeGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="#b46c5d"
            fill="url(#expenseGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
