import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NewGoalForm, SavingsGoals, SavingsHistory } from "@/components/savings-client"
import { getSavingsGoals, getSavingsMovements } from "@/lib/balance"
import { ensureRates, getQuotes, getUsdKind } from "@/lib/fx"
import { formatARS } from "@/lib/money"

export default async function SavingsPage() {
  await ensureRates()
  const [goals, history, quotes, usdKind] = await Promise.all([
    getSavingsGoals(),
    getSavingsMovements(),
    getQuotes(),
    getUsdKind(),
  ])
  const total = goals.reduce((acc, g) => acc + g.balance, 0)
  const quote = quotes.find((q) => q.kind === usdKind) ?? null
  const usdRate = quote ? { value: quote.sell, label: quote.label } : null
  // Los dólares valen lo que vale el dólar hoy, no lo que pagaste por ellos.
  const totalToday = usdRate
    ? goals.reduce((acc, g) => acc + (g.isUsd ? g.usd * usdRate.value : g.balance), 0)
    : null

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent>
          <div className="text-sm text-muted-foreground">Total ahorrado</div>
          <div className="text-4xl font-semibold tracking-tight tabular-nums">{formatARS(total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Plata apartada en sobres: no cuenta como disponible.
          </p>
          {totalToday !== null && goals.some((g) => g.isUsd && g.usd > 0) && (
            <p className="mt-2 text-sm tabular-nums">
              Con los dólares a valor de hoy ({usdRate!.label}): <b>{formatARS(totalToday)}</b>
            </p>
          )}
        </CardContent>
      </Card>

      <SavingsGoals goals={goals} usdRate={usdRate} />

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>Depósitos y retiros de tus sobres.</CardDescription>
        </CardHeader>
        <CardContent>
          <SavingsHistory items={history} />
        </CardContent>
      </Card>

      <NewGoalForm />
    </div>
  )
}
