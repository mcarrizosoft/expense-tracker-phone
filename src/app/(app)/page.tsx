import Link from "next/link"
import { ArrowDownLeftIcon, ArrowUpRightIcon, BellIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CategoryChart } from "@/components/category-chart"
import { MonthSwitcher } from "@/components/month-switcher"
import { TransactionList } from "@/components/transaction-list"
import { getCategories, getMonthSummary, getTransactions } from "@/lib/data"
import { currentMonth, isValidMonth } from "@/lib/dates"
import { SOURCE_LABELS } from "@/lib/labels"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = isValidMonth(monthParam) ? monthParam : currentMonth()

  const [summary, recent, categories] = await Promise.all([
    getMonthSummary(month),
    getTransactions({ month, limit: 8 }),
    getCategories(),
  ])
  const maxSource = Math.max(1, ...summary.bySource.map((s) => s.total))

  return (
    <div className="grid gap-4">
      <MonthSwitcher month={month} basePath="/" />

      <Card>
        <CardContent className="grid gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Gastado este mes</div>
            <div className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatARS(summary.out)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowDownLeftIcon className="size-3.5" /> Ingresos
              </div>
              <div className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatARS(summary.in)}
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRightIcon className="size-3.5" /> Balance
              </div>
              <div
                className={cn(
                  "font-semibold tabular-nums",
                  summary.balance < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {formatARS(summary.balance)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary.pending > 0 && (
        <Link
          href="/transactions?pending=1"
          className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm"
        >
          <BellIcon className="size-4 text-orange-500" />
          <span className="flex-1">
            Tenés <b>{summary.pending}</b> {summary.pending === 1 ? "movimiento" : "movimientos"} sin
            categoría
          </span>
          <span className="font-medium">Revisar →</span>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.byCategory.length > 0 ? (
            <CategoryChart data={summary.byCategory} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay gastos este mes.</p>
          )}
        </CardContent>
      </Card>

      {summary.bySource.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Por medio de pago</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {summary.bySource.map((s) => (
              <div key={s.source} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span>{SOURCE_LABELS[s.source]}</span>
                  <span className="font-medium tabular-nums">{formatARS(s.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(s.total / maxSource) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/transactions?month=${month}`}>Ver todos</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionList
            items={recent}
            categories={categories}
            emptyText="Sin movimientos. Agregá uno o configurá los Atajos en Ajustes."
          />
        </CardContent>
      </Card>
    </div>
  )
}
