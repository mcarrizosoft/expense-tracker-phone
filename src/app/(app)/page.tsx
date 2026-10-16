import Link from "next/link"
import { BellIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BalanceCard } from "@/components/balance-card"
import { CategoryChart } from "@/components/category-chart"
import { FixedBillsCard } from "@/components/fixed-bills-card"
import { MonthSwitcher } from "@/components/month-switcher"
import { TransactionList } from "@/components/transaction-list"
import { getCategories, getFixedBillsStatus, getMonthSummary, getTransactions } from "@/lib/data"
import { getBalances, getSavingsGoals } from "@/lib/balance"
import { currentMonth, isValidMonth, monthName, shiftMonth } from "@/lib/dates"
import { SOURCE_LABELS } from "@/lib/labels"
import { formatARS } from "@/lib/money"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = isValidMonth(monthParam) ? monthParam : currentMonth()

  const [summary, recent, categories, bills, balances, goals] = await Promise.all([
    getMonthSummary(month),
    getTransactions({ month, limit: 8 }),
    getCategories(),
    getFixedBillsStatus(month),
    getBalances(month),
    getSavingsGoals(),
  ])
  const balance = balances.get(month) ?? {
    month,
    opening: 0,
    openingIsManual: false,
    income: 0,
    spent: 0,
    saved: 0,
    closing: 0,
    closedAt: null,
  }
  const savingsTotal = goals.reduce((acc, g) => acc + g.balance, 0)
  const prevMonth = shiftMonth(month, -1)
  const prev = month === currentMonth() ? balances.get(prevMonth) : undefined
  const showCloseBanner = !!prev && !prev.closedAt && prev.closing > 0
  const maxSource = Math.max(1, ...summary.bySource.map((s) => s.total))

  return (
    <div className="grid gap-4">
      <MonthSwitcher month={month} basePath="/" />

      {showCloseBanner && (
        <Link
          href={`/close?month=${prevMonth}`}
          className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
        >
          <SparklesIcon className="size-4 shrink-0 text-emerald-500" />
          <span className="flex-1">
            Terminaste {monthName(prevMonth)} con <b>{formatARS(prev!.closing)}</b>. ¿Qué hacés con esa
            plata?
          </span>
          <span className="shrink-0 font-medium">Cerrar →</span>
        </Link>
      )}

      <BalanceCard balance={balance} savingsTotal={savingsTotal} />

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

      <FixedBillsCard bills={bills} month={month} />

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
