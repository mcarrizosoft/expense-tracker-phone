"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { payFixedBill } from "@/app/actions"
import type { TxSource } from "@/db/schema"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SOURCE_LABELS } from "@/lib/labels"

const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 })
const PAY_SOURCES: TxSource[] = ["galicia", "lemon", "mercadopago", "apple_pay", "manual", "other"]

export function PayBillButton({
  billId,
  name,
  emoji,
  expectedAmount,
  lastSource,
}: {
  billId: number
  name: string
  emoji: string
  expectedAmount: number | null
  lastSource: TxSource | null
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(expectedAmount ? fmt.format(expectedAmount) : "")
  const [source, setSource] = useState<TxSource>(lastSource ?? "galicia")
  const [pending, startTransition] = useTransition()

  function pay() {
    startTransition(async () => {
      const res = await payFixedBill({ billId, amount, source })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${name} pagado`)
      setOpen(false)
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Pagar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pagar {emoji} {name}
            </DialogTitle>
            <DialogDescription>Se registra como gasto de hoy y se descuenta de tu disponible.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`pay-amount-${billId}`}>Monto</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-muted-foreground">
                  $
                </span>
                <Input
                  id={`pay-amount-${billId}`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="h-12 pl-8 text-xl font-semibold tabular-nums"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Con qué pagaste</Label>
              <Select value={source} onValueChange={(v) => setSource(v as TxSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={pay} disabled={pending || !amount.trim()}>
              {pending ? "Pagando…" : `Confirmar pago`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
