import Link from "next/link"
import { ChevronRightIcon, PiggyBankIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { MonthBalance } from "@/lib/balance"
import { monthName, shiftMonth } from "@/lib/dates"
import { Change } from "@/components/dollar-card"
import { formatARS, formatUSD } from "@/lib/money"
import { cn } from "@/lib/utils"

function Row({
  label,
  value,
  sign,
  className,
}: {
  label: React.ReactNode
  value: number
  sign?: "+" | "−"
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", className)}>
        {sign && `${sign} `}
        {formatARS(value)}
      </span>
    </div>
  )
}

export type BalanceUsd = {
  /** Etiqueta del dólar de referencia ("MEP"). */
  label: string
  available: number | null
  spent: number
  prevSpent: number | null
}

export function BalanceCard({
  balance,
  savingsTotal,
  usd,
}: {
  balance: MonthBalance
  savingsTotal: number
  usd?: BalanceUsd | null
}) {
  const prev = monthName(shiftMonth(balance.month, -1))
  const noOpening = !balance.openingIsManual && balance.opening === 0

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Disponible</div>
          <div
            className={cn(
              "text-4xl font-semibold tracking-tight tabular-nums",
              balance.closing < 0 && "text-destructive"
            )}
          >
            {formatARS(balance.closing)}
          </div>
          {usd?.available != null && (
            <div className="text-sm text-muted-foreground tabular-nums">
              ≈ {formatUSD(usd.available)} <span className="text-xs">({usd.label})</span>
            </div>
          )}
        </div>

        <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
          {noOpening ? (
            <Link
              href={`/close?month=${balance.month}`}
              className="flex items-center justify-between text-sm text-orange-600 dark:text-orange-400"
            >
              Cargá con cuánto arrancaste el mes
              <ChevronRightIcon className="size-4" />
            </Link>
          ) : (
            <Row
              label={balance.openingIsManual ? "Saldo inicial" : `Saldo de ${prev}`}
              value={balance.opening}
            />
          )}
          <Row label="Ingresos" value={balance.income} sign="+" className="text-emerald-600 dark:text-emerald-400" />
          <Row label="Gastos" value={balance.spent} sign="−" />
          {balance.saved !== 0 && (
            <Row
              label={balance.saved > 0 ? "Apartado en ahorros" : "Sacado de ahorros"}
              value={Math.abs(balance.saved)}
              sign={balance.saved > 0 ? "−" : "+"}
            />
          )}
          {usd && usd.spent > 0 && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Gastos en dólares</span>
              <span className="flex items-center gap-2">
                {usd.prevSpent ? (
                  <Change value={((usd.spent - usd.prevSpent) / usd.prevSpent) * 100} />
                ) : null}
                <span className="font-medium tabular-nums">{formatUSD(usd.spent)}</span>
              </span>
              {usd.prevSpent ? (
                <span className="w-full text-xs text-muted-foreground tabular-nums">
                  {prev.charAt(0).toUpperCase() + prev.slice(1)}: {formatUSD(usd.prevSpent)} · cada gasto al dólar{" "}
                  {usd.label} de su día
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/savings" className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50">
            <PiggyBankIcon className="size-4 shrink-0 text-emerald-500" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">En ahorros</span>
              <span className="block truncate font-medium tabular-nums">{formatARS(savingsTotal)}</span>
            </span>
          </Link>
          <Link
            href={`/close?month=${balance.month}`}
            className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"
          >
            <span>
              <span className="block text-xs text-muted-foreground">Mes</span>
              <span className="block font-medium">{balance.closedAt ? "Cerrado ✓" : "Cierre de mes"}</span>
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
