import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { UsdQuote } from "@/lib/fx"
import type { UsdKind } from "@/lib/labels"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"

const pct = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function shortDate(date: string) {
  const [, m, d] = date.split("-").map(Number)
  return `${d} ${SHORT_MONTHS[m - 1]}`
}

export function Change({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null
  const flat = Math.abs(value) < 0.05
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        flat ? "text-muted-foreground" : value > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400",
        className
      )}
    >
      {flat ? "= sin cambios" : `${value > 0 ? "▲" : "▼"} ${pct.format(Math.abs(value))}%`}
    </span>
  )
}

export function DollarCard({ quotes, refKind }: { quotes: UsdQuote[]; refKind: UsdKind }) {
  const main = quotes.find((q) => q.kind === refKind) ?? quotes[0]
  if (!main) return null
  const others = quotes.filter((q) => q.kind !== main.kind)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dólar {main.label}</CardTitle>
        <CardDescription>Al {shortDate(main.date)} · tu referencia para los montos en US$</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings#dolar">Cambiar</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatARS(main.sell)}</span>
          <Change value={main.changePct} />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          Venta (lo que pagás por cada dólar) · compra {formatARS(main.buy)}
        </div>
        {others.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {others.map((q) => (
              <div key={q.kind} className="min-w-0 rounded-lg bg-muted/50 p-2.5">
                <div className="text-xs text-muted-foreground">{q.label}</div>
                <div className="truncate text-sm font-medium tabular-nums">{formatARS(q.sell)}</div>
                <Change value={q.changePct} className="text-[11px]" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
