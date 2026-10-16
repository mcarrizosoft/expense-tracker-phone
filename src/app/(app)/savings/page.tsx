import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NewGoalForm, SavingsGoals, SavingsHistory } from "@/components/savings-client"
import { getSavingsGoals, getSavingsMovements } from "@/lib/balance"
import { formatARS } from "@/lib/money"

export default async function SavingsPage() {
  const [goals, history] = await Promise.all([getSavingsGoals(), getSavingsMovements()])
  const total = goals.reduce((acc, g) => acc + g.balance, 0)

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent>
          <div className="text-sm text-muted-foreground">Total ahorrado</div>
          <div className="text-4xl font-semibold tracking-tight tabular-nums">{formatARS(total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Plata apartada en sobres: no cuenta como disponible.
          </p>
        </CardContent>
      </Card>

      <SavingsGoals goals={goals} />

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
