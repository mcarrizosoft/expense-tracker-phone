import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CloseMonthForm, OpeningBalanceForm } from "@/components/close-month-form"
import { MonthSwitcher } from "@/components/month-switcher"
import { getMonthBalance, getSavingsGoals } from "@/lib/balance"
import { currentMonth, isValidMonth, monthName, shiftMonth } from "@/lib/dates"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 text-sm", strong && "border-t pt-2 text-base font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default async function CloseMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = isValidMonth(monthParam) ? monthParam : shiftMonth(currentMonth(), -1)
  const [balance, goals] = await Promise.all([getMonthBalance(month), getSavingsGoals()])
  const label = monthName(month)
  const next = monthName(shiftMonth(month, 1))

  return (
    <div className="grid gap-4">
      <MonthSwitcher month={month} basePath="/close" />

      <OpeningBalanceForm balance={balance} monthLabel={label} />

      <Card>
        <CardHeader>
          <CardTitle>Resumen de {label}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Line label="Saldo inicial" value={formatARS(balance.opening)} />
          <Line label="+ Ingresos" value={formatARS(balance.income)} />
          <Line label="− Gastos" value={formatARS(balance.spent)} />
          {balance.saved !== 0 && (
            <Line
              label={balance.saved > 0 ? "− Apartado en ahorros" : "+ Sacado de ahorros"}
              value={formatARS(Math.abs(balance.saved))}
            />
          )}
          <Line label="Te quedó" value={formatARS(balance.closing)} strong />
        </CardContent>
      </Card>

      <CloseMonthForm
        balance={balance}
        goals={goals}
        monthLabel={label}
        nextMonthLabel={next}
        isPastMonth={month < currentMonth()}
      />
    </div>
  )
}
