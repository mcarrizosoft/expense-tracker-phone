"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createTransaction, updateTransaction, type ActionResult } from "@/app/actions"
import type { Category, TxSource, TxType } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { TransactionWithCategory } from "@/lib/data"
import { toLocalInputValue } from "@/lib/dates"
import { SOURCE_LABELS, TYPE_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

const amountFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 })

export function TransactionForm({
  categories,
  initial,
  onDone,
}: {
  categories: Category[]
  initial?: TransactionWithCategory
  onDone?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ? String(initial.categoryId) : "none"
  )
  const [merchant, setMerchant] = useState(initial?.merchant ?? "")
  const [formKey, setFormKey] = useState(0)

  function submit(formData: FormData) {
    formData.set("categoryId", categoryId)
    startTransition(async () => {
      let result: ActionResult
      try {
        result = initial
          ? await updateTransaction(initial.id, formData)
          : await createTransaction(formData)
      } catch {
        result = { ok: false, error: "No se pudo guardar. Probá de nuevo." }
      }
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(initial ? "Movimiento actualizado" : "Movimiento guardado")
      if (!initial) {
        setCategoryId("none")
        setMerchant("")
        setFormKey((k) => k + 1)
      }
      onDone?.()
    })
  }

  return (
    <form key={formKey} action={submit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="amount">Monto</Label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-2xl text-muted-foreground">
            $
          </span>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            required
            autoFocus={!initial}
            defaultValue={initial ? amountFormatter.format(Number(initial.amount)) : ""}
            className="h-14 pl-8 text-2xl font-semibold tabular-nums md:text-2xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-2">
          <Label>Tipo</Label>
          <Select name="type" defaultValue={initial?.type ?? "expense"}>
            <SelectTrigger className="w-full min-w-0 *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as TxType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-2">
          <Label>Medio</Label>
          <Select name="source" defaultValue={initial?.source ?? "manual"}>
            <SelectTrigger className="w-full min-w-0 *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SOURCE_LABELS) as TxSource[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = categoryId === String(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(selected ? "none" : String(c.id))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
                  selected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <span>{c.emoji}</span>
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant">Comercio / destinatario</Label>
        <Input
          id="merchant"
          name="merchant"
          placeholder="Ej: Coto, Juan Pérez"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
        {merchant.trim() && categoryId !== "none" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="rememberMerchant" className="size-4 accent-primary" />
            Usar siempre esta categoría para &quot;{merchant.trim()}&quot;
          </label>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Nota</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Opcional"
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="occurredAt">Fecha y hora</Label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(initial?.occurredAt ?? new Date())}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : initial ? "Guardar cambios" : "Agregar movimiento"}
      </Button>
    </form>
  )
}
