"use client"

import { Cell, Pie, PieChart } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { formatARS } from "@/lib/money"

type Slice = { name: string; emoji: string; color: string; total: number }

export function CategoryChart({ data }: { data: Slice[] }) {
  const total = data.reduce((acc, d) => acc + d.total, 0)
  const config = Object.fromEntries(
    data.map((d, i) => [`c${i}`, { label: d.name, color: d.color }])
  ) satisfies ChartConfig

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[180px]">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const item = payload?.[0]?.payload as Slice | undefined
              if (!active || !item) return null
              return (
                <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-md">
                  {item.emoji} {item.name}: <span className="font-medium">{formatARS(item.total)}</span>
                </div>
              )
            }}
          />
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius="60%"
            outerRadius="100%"
            strokeWidth={2}
            stroke="var(--card)"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="grid gap-3">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate">
              {d.emoji} {d.name}
            </span>
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
              {total > 0 ? Math.round((d.total / total) * 100) : 0}%
            </span>
            <span className="text-right font-medium tabular-nums">{formatARS(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
