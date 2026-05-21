"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts"
import { RainfallDay } from "@/app/types/apolice"

type Props = {
  data: RainfallDay[]
  thresholdMm: number
}

// Converte dia absoluto (epoch/86400) para "DD/MM" — UI-friendly.
function dayToDDMM(day: number): string {
  const d = new Date(day * 86400 * 1000)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}`
}

// "DD/MM/YYYY" para o tooltip — mais explícito quando o usuário hover.
function dayToFullDate(day: number): string {
  const d = new Date(day * 86400 * 1000)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

export function RainfallChart({ data, thresholdMm }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => dayToDDMM(Number(v))}
          minTickGap={16}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}mm`}
        />
        <Tooltip
          formatter={(value) => [value != null ? `${Number(value).toFixed(2)} mm` : "N/A", "Chuva"]}
          labelFormatter={(label) => dayToFullDate(Number(label))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e5e7eb" }}
        />
        <ReferenceLine
          y={thresholdMm}
          stroke="#F59E0B"
          strokeDasharray="4 3"
          label={{ value: `Limiar ${thresholdMm}mm`, fill: "#92400E", fontSize: 10, position: "right" }}
        />
        <Bar dataKey="mm" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.mm < thresholdMm ? "#FCA5A5" : "#60A5FA"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
