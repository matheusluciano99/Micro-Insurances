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

export function RainfallChart({ data, thresholdMm }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Dia", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}mm`}
        />
        <Tooltip
          formatter={(value) => [value != null ? `${Number(value).toFixed(1)} mm` : "N/A", "Chuva"]}
          labelFormatter={(label) => `Dia ${label}`}
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
