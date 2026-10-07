"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { Category, TxSource } from "@/db/schema"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SOURCE_LABELS } from "@/lib/labels"

export function TransactionFilters({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value === "all") next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next}`)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select value={params.get("source") ?? "all"} onValueChange={(v) => set("source", v)}>
        <SelectTrigger className="w-full" aria-label="Filtrar por medio">
          <span className="text-muted-foreground">Medio</span>
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {(Object.keys(SOURCE_LABELS) as TxSource[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SOURCE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("category") ?? "all"} onValueChange={(v) => set("category", v)}>
        <SelectTrigger className="w-full" aria-label="Filtrar por categoría">
          <span className="text-muted-foreground">Categ.</span>
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="none">❔ Sin categoría</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.emoji} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
