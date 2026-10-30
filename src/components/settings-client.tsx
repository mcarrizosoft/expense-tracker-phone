"use client"

import { useRef, useState, useTransition } from "react"
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import {
  createCategory,
  createFixedBill,
  deleteCategory,
  deleteFixedBill,
  deleteMerchantRule,
} from "@/app/actions"
import type { Category } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FixedBillStatus } from "@/lib/data"
import { formatARS } from "@/lib/money"

export function CopyField({ value, secret = false }: { value: string; secret?: boolean }) {
  const [visible, setVisible] = useState(!secret)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2.5 font-mono text-xs">
        {visible ? value : "•".repeat(24)}
      </code>
      {secret && (
        <Button variant="ghost" size="icon" onClick={() => setVisible((v) => !v)} aria-label="Mostrar">
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={copy} aria-label="Copiar">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function add(formData: FormData) {
    startTransition(async () => {
      const res = await createCategory(formData)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Categoría creada")
      formRef.current?.reset()
    })
  }

  function remove(c: Category) {
    if (!confirm(`¿Borrar "${c.name}"? Los movimientos quedan sin categoría.`)) return
    startTransition(async () => {
      await deleteCategory(c.id)
      toast.success("Categoría borrada")
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1.5 rounded-full border py-1.5 pr-1.5 pl-3 text-sm"
            style={{ borderColor: c.color }}
          >
            {c.emoji} {c.name}
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(c)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Borrar ${c.name}`}
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <form ref={formRef} action={add} className="grid gap-3 rounded-xl border border-dashed p-3">
        <div className="text-xs font-medium text-muted-foreground">Nueva categoría</div>
        <div className="flex gap-2">
          <Input name="emoji" defaultValue="💸" className="w-14 shrink-0 text-center text-lg" aria-label="Emoji" />
          <Input name="name" placeholder="Nombre, ej: Mascotas" required className="min-w-0 flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="color"
              name="color"
              defaultValue="#737373"
              className="size-10 cursor-pointer rounded-lg border bg-transparent p-1"
            />
            Color
          </label>
          <Button type="submit" className="ml-auto" disabled={pending}>
            Agregar categoría
          </Button>
        </div>
      </form>
    </div>
  )
}

export function RuleList({
  rules,
}: {
  rules: { id: number; pattern: string; categoryName: string; categoryEmoji: string }[]
}) {
  const [pending, startTransition] = useTransition()

  if (rules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay reglas. Al editar un movimiento con comercio, marcá &quot;Usar siempre esta
        categoría&quot; y los próximos pagos ahí se categorizan solos.
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {rules.map((r) => (
        <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
          <span className="flex-1 truncate">
            Contiene <b>&quot;{r.pattern}&quot;</b> → {r.categoryEmoji} {r.categoryName}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label="Borrar regla"
            onClick={() =>
              startTransition(async () => {
                await deleteMerchantRule(r.id)
                toast.success("Regla borrada")
              })
            }
          >
            <XIcon />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function FixedBillManager({
  bills,
  categories,
}: {
  bills: FixedBillStatus[]
  categories: Category[]
}) {
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState<string>("")
  const [formKey, setFormKey] = useState(0)

  function add(formData: FormData) {
    formData.set("categoryId", categoryId)
    startTransition(async () => {
      const res = await createFixedBill(formData)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Cuenta fija agregada")
      setCategoryId("")
      setFormKey((k) => k + 1)
    })
  }

  function remove(b: FixedBillStatus) {
    if (!confirm(`¿Quitar "${b.name}" de las cuentas fijas? Los pagos ya registrados no se borran.`)) return
    startTransition(async () => {
      await deleteFixedBill(b.id)
      toast.success("Cuenta fija quitada")
    })
  }

  return (
    <div className="grid gap-4">
      {bills.length > 0 && (
        <ul className="divide-y">
          {bills.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="text-lg">{b.categoryEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[
                    b.categoryName,
                    b.pattern && `empieza con "${b.pattern}"`,
                    b.dueDay && `vence el ${b.dueDay}`,
                    b.expectedAmount !== null && `~${formatARS(b.expectedAmount)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Quitar ${b.name}`}
                onClick={() => remove(b)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form key={formKey} action={add} className="grid gap-3 rounded-xl border border-dashed p-3">
        <div className="text-xs font-medium text-muted-foreground">Nueva cuenta fija</div>
        <Input name="name" placeholder="Nombre, ej: Internet" required />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.emoji} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input name="expectedAmount" inputMode="decimal" placeholder="Monto aprox." />
          <Input name="dueDay" inputMode="numeric" placeholder="Vence el día…" />
        </div>
        <Input name="pattern" placeholder="El comercio empieza con… (opcional)" />
        <p className="text-xs text-muted-foreground">
          Se marca pagada cuando tocás «Pagar» en el inicio, o cuando llega un gasto de los Atajos
          cuyo comercio empieza con el nombre (ej: «Luz depto» → Luz). Si el comercio se llama
          distinto, completá con qué empieza.
        </p>
        <Button type="submit" disabled={pending || !categoryId}>
          Agregar cuenta fija
        </Button>
      </form>
    </div>
  )
}
