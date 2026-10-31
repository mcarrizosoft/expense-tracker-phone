"use client"

import { useRef, useState, useTransition } from "react"
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import {
  createSavingsGoal,
  deleteSavingsGoal,
  deleteSavingsMovement,
  moveSavings,
  updateSavingsTarget,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SavingsGoalWithBalance } from "@/lib/balance"
import { formatARS, parseAmount } from "@/lib/money"

const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Move = { goal: SavingsGoalWithBalance; kind: "deposit" | "withdraw" }

type UsdRate = { value: number; label: string } | null

export function SavingsGoals({ goals, usdRate }: { goals: SavingsGoalWithBalance[]; usdRate: UsdRate }) {
  const [move, setMove] = useState<Move | null>(null)
  const [editing, setEditing] = useState<SavingsGoalWithBalance | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(g: SavingsGoalWithBalance) {
    const warning =
      g.balance !== 0
        ? ` Tiene ${formatARS(g.balance)}: esa plata vuelve a contar como disponible.`
        : ""
    if (!confirm(`¿Borrar el sobre "${g.name}"?${warning}`)) return
    startTransition(async () => {
      await deleteSavingsGoal(g.id)
      toast.success("Sobre borrado")
      setEditing(null)
    })
  }

  return (
    <>
      <div className="grid gap-3">
        {goals.map((g) => {
          const progress = g.target ? Math.min(100, Math.max(0, (g.balance / g.target) * 100)) : null
          const avgRate = g.isUsd && g.usd > 0 ? g.balance / g.usd : null
          return (
            <Card key={g.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${g.color}22` }}
                  >
                    {g.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{g.name}</div>
                    <div className="text-2xl font-semibold tracking-tight tabular-nums">
                      {g.isUsd ? `US$ ${fmt.format(g.usd)}` : formatARS(g.balance)}
                    </div>
                    {g.isUsd && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatARS(g.balance)} invertidos
                        {avgRate && ` · cotización promedio ${formatARS(avgRate)}`}
                      </div>
                    )}
                    {g.isUsd && usdRate && g.usd > 0 && (
                      <div className="text-xs tabular-nums">
                        Hoy valen <b>{formatARS(g.usd * usdRate.value)}</b> ({usdRate.label})
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Editar ${g.name}`} onClick={() => setEditing(g)}>
                    <PencilIcon />
                  </Button>
                </div>

                {progress !== null && (
                  <div className="grid gap-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: g.color }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>{Math.round(progress)}%</span>
                      <span>Meta {formatARS(g.target!)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setMove({ goal: g, kind: "deposit" })}>
                    <ArrowDownToLineIcon /> Depositar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMove({ goal: g, kind: "withdraw" })}
                    disabled={g.balance <= 0}
                  >
                    <ArrowUpFromLineIcon /> Retirar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <MoveDialog move={move} usdRate={usdRate} onClose={() => setMove(null)} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.emoji} {editing?.name}
            </DialogTitle>
            <DialogDescription>Meta de ahorro (en pesos). Dejala vacía para no tener meta.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="grid gap-4"
              action={(fd) =>
                startTransition(async () => {
                  const res = await updateSavingsTarget(editing.id, String(fd.get("target") ?? ""))
                  if (!res.ok) return void toast.error(res.error)
                  toast.success("Meta actualizada")
                  setEditing(null)
                })
              }
            >
              <Input
                name="target"
                inputMode="decimal"
                placeholder="Ej: 1.500.000"
                defaultValue={editing.target ? fmt.format(editing.target) : ""}
              />
              <Button type="submit" size="lg" disabled={pending}>
                Guardar meta
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(editing)}
                disabled={pending}
              >
                <Trash2Icon /> Borrar sobre
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function MoveDialog({
  move,
  usdRate,
  onClose,
}: {
  move: Move | null
  usdRate: UsdRate
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState("")
  // null = sin tocar: se propone el dólar de referencia de hoy.
  const [rateInput, setRate] = useState<string | null>(null)
  const rate = rateInput ?? (usdRate ? fmt.format(usdRate.value) : "")

  const isUsd = move?.goal.isUsd ?? false
  const ars = amount ? parseAmount(amount) : null
  const r = rate ? parseAmount(rate) : null
  const usd = isUsd && ars && r ? Math.round((ars / r) * 100) / 100 : null

  function close() {
    setAmount("")
    setRate(null)
    onClose()
  }

  function submit(formData: FormData) {
    if (!move) return
    if (isUsd && !usd) return void toast.error("Poné la cotización del dólar")
    formData.set("goalId", String(move.goal.id))
    formData.set("kind", move.kind)
    if (usd) formData.set("usd", String(usd))
    startTransition(async () => {
      const res = await moveSavings(formData)
      if (!res.ok) return void toast.error(res.error)
      toast.success(move.kind === "deposit" ? "Plata apartada" : "Plata retirada: vuelve a disponible")
      close()
    })
  }

  return (
    <Dialog open={!!move} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {move?.kind === "deposit" ? "Depositar en" : "Retirar de"} {move?.goal.emoji} {move?.goal.name}
          </DialogTitle>
          <DialogDescription>
            {move?.kind === "deposit"
              ? "Sale de tu disponible de este mes."
              : "Vuelve a tu disponible de este mes."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="move-amount">Pesos</Label>
            <Input
              id="move-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 text-lg tabular-nums"
            />
          </div>
          {isUsd && (
            <div className="grid gap-2">
              <Label htmlFor="move-rate">Cotización del dólar</Label>
              <Input
                id="move-rate"
                inputMode="decimal"
                placeholder="Ej: 1.420"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="tabular-nums"
              />
              <p className="text-sm text-muted-foreground">
                {usd && `= US$ ${fmt.format(usd)}`}
                {usd && rateInput === null && usdRate && " · "}
                {rateInput === null && usdRate && `${usdRate.label} de hoy; cambialo si pagaste otro precio`}
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="move-note">Nota</Label>
            <Input id="move-note" name="note" placeholder="Opcional" />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {move?.kind === "deposit" ? "Depositar" : "Retirar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewGoalForm() {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function add(formData: FormData) {
    startTransition(async () => {
      const res = await createSavingsGoal(formData)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Sobre creado")
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} action={add} className="grid gap-3 rounded-xl border border-dashed p-3">
      <div className="text-xs font-medium text-muted-foreground">Nuevo sobre</div>
      <div className="flex gap-2">
        <Input name="emoji" defaultValue="💰" className="w-14 shrink-0 text-center text-lg" aria-label="Emoji" />
        <Input name="name" placeholder="Nombre, ej: Auto nuevo" required className="min-w-0 flex-1" />
      </div>
      <Input name="target" inputMode="decimal" placeholder="Meta en pesos (opcional)" />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="isUsd" className="size-4 accent-primary" />
        Es en dólares (registra la cotización)
      </label>
      <Button type="submit" disabled={pending}>
        Crear sobre
      </Button>
    </form>
  )
}

export function SavingsHistory({
  items,
}: {
  items: {
    id: number
    month: string
    amount: string
    usd: string | null
    note: string
    goalName: string
    goalEmoji: string
  }[]
}) {
  const [pending, startTransition] = useTransition()

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Todavía no apartaste plata.</p>
  }

  return (
    <ul className="divide-y">
      {items.map((m) => {
        const amount = Number(m.amount)
        return (
          <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="text-lg">{m.goalEmoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.goalName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[m.month, m.note, m.usd && `US$ ${fmt.format(Math.abs(Number(m.usd)))}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span className="shrink-0 font-medium tabular-nums">
              {amount >= 0 ? "+" : "−"}
              {formatARS(Math.abs(amount))}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label="Deshacer"
              onClick={() => {
                if (!confirm("¿Deshacer este movimiento de ahorro?")) return
                startTransition(async () => {
                  await deleteSavingsMovement(m.id)
                  toast.success("Movimiento deshecho")
                })
              }}
            >
              <XIcon />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
