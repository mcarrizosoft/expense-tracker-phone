"use client"

import { useState, useTransition } from "react"
import { TagIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { deleteTransaction, quickCategorize } from "@/app/actions"
import type { Category } from "@/db/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TransactionForm } from "@/components/transaction-form"
import type { FixedBillOption, TransactionWithCategory } from "@/lib/data"
import { formatDateTime } from "@/lib/dates"
import { SOURCE_LABELS, TYPE_LABELS, isIncoming, isOutgoing } from "@/lib/labels"
import { formatARS, formatUSD } from "@/lib/money"
import { cn } from "@/lib/utils"

export function TransactionList({
  items,
  categories,
  fixedBills = [],
  emptyText = "No hay movimientos.",
}: {
  items: (TransactionWithCategory & { usd?: number | null })[]
  categories: Category[]
  fixedBills?: FixedBillOption[]
  emptyText?: string
}) {
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null)
  const [pending, startTransition] = useTransition()

  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  function categorize(id: number, categoryId: string) {
    startTransition(async () => {
      const res = await quickCategorize(id, Number(categoryId))
      if (res.ok) toast.success("Categoría asignada")
    })
  }

  function remove(id: number) {
    if (!confirm("¿Borrar este movimiento?")) return
    startTransition(async () => {
      const res = await deleteTransaction(id)
      if (res.ok) {
        toast.success("Movimiento borrado")
        setEditing(null)
      }
    })
  }

  return (
    <>
      <ul className="divide-y">
        {items.map((tx) => {
          const out = isOutgoing(tx.type)
          const sign = out ? "−" : isIncoming(tx.type) ? "+" : "⇄ "
          const meta = [formatDateTime(tx.occurredAt), SOURCE_LABELS[tx.source], tx.category?.name]
            .filter(Boolean)
            .join(" · ")
          return (
            <li key={tx.id} className="grid gap-3 py-4 first:pt-1 last:pb-1">
              <button
                type="button"
                onClick={() => setEditing(tx)}
                className="flex w-full items-center gap-3 rounded-lg text-left"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                  {tx.category?.emoji ?? <TagIcon className="size-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {tx.merchant || tx.description || TYPE_LABELS[tx.type]}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{meta}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      isIncoming(tx.type) && "text-emerald-600 dark:text-emerald-400",
                      tx.type === "internal" && "text-muted-foreground"
                    )}
                  >
                    {sign}
                    {formatARS(tx.amount)}
                  </span>
                  {tx.usd != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">≈ {formatUSD(tx.usd)}</span>
                  )}
                  {tx.needsReview && (
                    <Badge
                      variant="outline"
                      className="border-orange-500/50 text-orange-600 dark:text-orange-400"
                    >
                      Por revisar
                    </Badge>
                  )}
                </div>
              </button>
              {tx.needsReview && (
                <div className="pl-13">
                  <Select disabled={pending} onValueChange={(v) => categorize(tx.id, v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Asignar categoría…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.emoji} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
            <DialogDescription>
              {editing && `${SOURCE_LABELS[editing.source]} · ${formatDateTime(editing.occurredAt)}`}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <TransactionForm
                key={editing.id}
                categories={categories}
                fixedBills={fixedBills}
                initial={editing}
                onDone={() => setEditing(null)}
              />
              <Separator />
              <Button
                variant="outline"
                size="lg"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pending}
                onClick={() => remove(editing.id)}
              >
                <Trash2Icon /> Borrar movimiento
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
