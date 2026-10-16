"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { closeMonth, reopenMonth, setOpeningBalance } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MonthBalance, SavingsGoalWithBalance } from "@/lib/balance"
import { formatARS, parseAmount } from "@/lib/money"
import { cn } from "@/lib/utils"

const amountFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 })

export function OpeningBalanceForm({ balance, monthLabel }: { balance: MonthBalance; monthLabel: string }) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(
    balance.openingIsManual ? amountFormatter.format(balance.opening) : ""
  )

  function save() {
    startTransition(async () => {
      const res = await setOpeningBalance(balance.month, value)
      if (!res.ok) return void toast.error(res.error)
      toast.success(value.trim() ? "Saldo inicial guardado" : "Saldo inicial borrado: se usa el del mes anterior")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo inicial de {monthLabel}</CardTitle>
        <CardDescription>
          Lo que tenías el día 1 entre Galicia, Lemon y efectivo.{" "}
          {balance.openingIsManual
            ? "Lo cargaste a mano."
            : `Si lo dejás vacío, se usa lo que sobró del mes anterior (${formatARS(balance.opening)}).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            inputMode="decimal"
            placeholder={amountFormatter.format(balance.opening)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-7 tabular-nums"
            aria-label="Saldo inicial"
          />
        </div>
        <Button onClick={save} disabled={pending}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}

export function CloseMonthForm({
  balance,
  goals,
  monthLabel,
  nextMonthLabel,
  isPastMonth,
}: {
  balance: MonthBalance
  goals: SavingsGoalWithBalance[]
  monthLabel: string
  nextMonthLabel: string
  isPastMonth: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [rate, setRate] = useState("")

  const parsed = useMemo(
    () =>
      goals.map((g) => ({ goal: g, amount: amounts[g.id] ? (parseAmount(amounts[g.id]) ?? 0) : 0 })),
    [goals, amounts]
  )
  const allocated = parsed.reduce((acc, p) => acc + p.amount, 0)
  const remaining = balance.closing - allocated
  const usdRate = rate ? parseAmount(rate) : null

  function submit() {
    const allocations = parsed
      .filter((p) => p.amount > 0)
      .map((p) => ({
        goalId: p.goal.id,
        amount: p.amount,
        usd: p.goal.isUsd && usdRate ? Math.round((p.amount / usdRate) * 100) / 100 : undefined,
      }))
    if (allocations.some((a) => goals.find((g) => g.id === a.goalId)?.isUsd && !a.usd)) {
      return void toast.error("Poné la cotización a la que compraste los dólares")
    }
    startTransition(async () => {
      const res = await closeMonth(balance.month, allocations)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Cerraste ${monthLabel}`)
      router.push("/")
    })
  }

  function reopen() {
    startTransition(async () => {
      await reopenMonth(balance.month)
      toast.success("Mes reabierto")
    })
  }

  if (balance.closedAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{monthLabel} está cerrado ✓</CardTitle>
          <CardDescription>
            Pasaron {formatARS(balance.closing)} a {nextMonthLabel}
            {balance.saved > 0 && ` y apartaste ${formatARS(balance.saved)} en ahorros`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={reopen} disabled={pending}>
            Reabrir para repartir de nuevo
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Qué hacés con lo que sobró?</CardTitle>
        <CardDescription>
          {balance.closing > 0
            ? `Te quedan ${formatARS(balance.closing)}. Apartá lo que quieras en tus sobres; el resto pasa a ${nextMonthLabel}.`
            : `Terminaste ${monthLabel} en ${formatARS(balance.closing)}, no hay sobrante para repartir.`}
          {!isPastMonth && " Ojo: el mes todavía no terminó."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {balance.closing > 0 &&
          goals.map((g) => (
            <div key={g.id} className="grid gap-2">
              <Label htmlFor={`goal-${g.id}`} className="flex items-center justify-between">
                <span>
                  {g.emoji} {g.name}
                </span>
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  tiene {g.isUsd ? `US$ ${amountFormatter.format(g.usd)}` : formatARS(g.balance)}
                </span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id={`goal-${g.id}`}
                    inputMode="decimal"
                    placeholder="0"
                    value={amounts[g.id] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [g.id]: e.target.value }))}
                    className="pl-7 tabular-nums"
                  />
                </div>
                {g.isUsd && (
                  <Input
                    inputMode="decimal"
                    placeholder="Cotización"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-32 tabular-nums"
                    aria-label="Cotización del dólar"
                  />
                )}
              </div>
              {g.isUsd && usdRate && (parsed.find((p) => p.goal.id === g.id)?.amount ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ US${" "}
                  {amountFormatter.format((parsed.find((p) => p.goal.id === g.id)!.amount ?? 0) / usdRate)}
                </p>
              )}
            </div>
          ))}

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Pasa a {nextMonthLabel}</span>
          <span className={cn("font-semibold tabular-nums", remaining < 0 && "text-destructive")}>
            {formatARS(remaining)}
          </span>
        </div>
        {remaining < 0 && (
          <p className="text-sm text-destructive">Estás apartando más de lo que te sobró.</p>
        )}

        <Button size="lg" onClick={submit} disabled={pending || remaining < 0}>
          Cerrar {monthLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
