import Link from "next/link"
import { CheckCircle2Icon, CircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PayBillButton } from "@/components/pay-bill-button"
import type { FixedBillStatus } from "@/lib/data"
import { currentMonth, formatDateTime, todayDay } from "@/lib/dates"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"

export function FixedBillsCard({ bills, month }: { bills: FixedBillStatus[]; month: string }) {
  const isCurrent = month === currentMonth()
  const today = todayDay()
  const paid = bills.filter((b) => b.paidAmount !== null)
  const remaining = bills
    .filter((b) => b.paidAmount === null)
    .reduce((acc, b) => acc + (b.expectedAmount ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas fijas</CardTitle>
        <CardDescription>
          {bills.length === 0
            ? "Lo que pagás todos los meses"
            : `${paid.length} de ${bills.length} pagadas${remaining > 0 ? ` · faltan ~${formatARS(remaining)}` : ""}`}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings#cuentas-fijas">Editar</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Agregá el alquiler, la luz, internet… en{" "}
            <Link href="/settings#cuentas-fijas" className="underline underline-offset-2">
              Ajustes
            </Link>{" "}
            y vas a ver acá cuáles ya pagaste este mes.
          </p>
        ) : (
          <ul className="divide-y">
            {bills.map((b) => {
              const isPaid = b.paidAmount !== null
              const overdue = !isPaid && isCurrent && b.dueDay !== null && today > b.dueDay

              return (
                <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {isPaid ? (
                    <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
                  ) : (
                    <CircleIcon
                      className={cn("size-5 shrink-0", overdue ? "text-destructive" : "text-muted-foreground")}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {b.categoryEmoji} {b.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {isPaid
                        ? `Pagado ${formatDateTime(b.paidAt!)}`
                        : b.dueDay
                          ? `Vence el ${b.dueDay}`
                          : "Sin vencimiento"}
                    </div>
                  </div>
                  {isPaid ? (
                    <span className="shrink-0 font-semibold tabular-nums">{formatARS(b.paidAmount!)}</span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      {overdue && <Badge variant="destructive">Vencida</Badge>}
                      {b.expectedAmount !== null && !overdue && (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatARS(b.expectedAmount)}
                        </span>
                      )}
                      {isCurrent && (
                        <PayBillButton
                          billId={b.id}
                          name={b.name}
                          emoji={b.categoryEmoji}
                          expectedAmount={b.expectedAmount}
                          lastSource={b.lastSource}
                        />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
