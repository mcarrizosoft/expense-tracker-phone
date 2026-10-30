"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  categories,
  fixedBills,
  merchantRules,
  monthBalances,
  savingsGoals,
  savingsMovements,
  transactions,
  txSourceEnum,
  txTypeEnum,
} from "@/db/schema"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  safeEqual,
  verifySessionToken,
} from "@/lib/auth"
import { currentMonth, fromLocalInputValue, isValidMonth } from "@/lib/dates"
import { parseAmount } from "@/lib/money"

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireSession() {
  const store = await cookies()
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value))) {
    throw new Error("No autorizado")
  }
}

function refresh() {
  revalidatePath("/", "layout")
}

// --- Sesión ---------------------------------------------------------------

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "")
  const expected = process.env.APP_PASSWORD
  if (!expected || !(await safeEqual(password, expected))) {
    return { ok: false, error: "Contraseña incorrecta" }
  }
  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
  redirect("/")
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/login")
}

// --- Movimientos ----------------------------------------------------------

const txSchema = z.object({
  amount: z.string().min(1, "Ingresá un monto"),
  type: z.enum(txTypeEnum.enumValues),
  source: z.enum(txSourceEnum.enumValues),
  merchant: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
  categoryId: z.string().optional(),
  occurredAt: z.string().optional(),
  rememberMerchant: z.string().optional(),
  fixedBillId: z.string().optional(),
})

function parseTxForm(formData: FormData) {
  const parsed = txSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" } as const

  const d = parsed.data
  const amount = parseAmount(d.amount)
  if (amount === null) return { error: "Monto inválido" } as const

  const categoryId = d.categoryId && d.categoryId !== "none" ? Number(d.categoryId) : null
  const fixedBillId = d.fixedBillId && d.fixedBillId !== "none" ? Number(d.fixedBillId) : null
  const occurredAt = d.occurredAt ? fromLocalInputValue(d.occurredAt) : new Date()
  if (Number.isNaN(occurredAt.getTime())) return { error: "Fecha inválida" } as const

  return {
    values: {
      amount: amount.toFixed(2),
      type: d.type,
      source: d.source,
      merchant: d.merchant || null,
      description: d.description ?? "",
      categoryId,
      fixedBillId,
      occurredAt,
      needsReview: false,
    },
    rememberMerchant: d.rememberMerchant === "on",
  } as const
}

async function saveMerchantRule(merchant: string | null, categoryId: number | null) {
  if (!merchant || !categoryId) return
  await db
    .insert(merchantRules)
    .values({ pattern: merchant.trim(), categoryId })
    .onConflictDoUpdate({ target: merchantRules.pattern, set: { categoryId } })
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  await requireSession()
  const result = parseTxForm(formData)
  if ("error" in result) return { ok: false, error: result.error! }

  await db.insert(transactions).values(result.values)
  if (result.rememberMerchant) {
    await saveMerchantRule(result.values.merchant, result.values.categoryId)
  }
  refresh()
  return { ok: true }
}

export async function updateTransaction(id: number, formData: FormData): Promise<ActionResult> {
  await requireSession()
  const result = parseTxForm(formData)
  if ("error" in result) return { ok: false, error: result.error! }

  await db.update(transactions).set(result.values).where(eq(transactions.id, id))
  if (result.rememberMerchant) {
    await saveMerchantRule(result.values.merchant, result.values.categoryId)
  }
  refresh()
  return { ok: true }
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(transactions).where(eq(transactions.id, id))
  refresh()
  return { ok: true }
}

export async function quickCategorize(id: number, categoryId: number): Promise<ActionResult> {
  await requireSession()
  await db
    .update(transactions)
    .set({ categoryId, needsReview: false })
    .where(eq(transactions.id, id))
  refresh()
  return { ok: true }
}

// --- Categorías y reglas --------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(40),
  emoji: z.string().trim().min(1).max(8).default("💸"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").default("#737373"),
})

export async function createCategory(formData: FormData): Promise<ActionResult> {
  await requireSession()
  const parsed = categorySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const inserted = await db.insert(categories).values(parsed.data).onConflictDoNothing().returning()
  if (inserted.length === 0) return { ok: false, error: "Ya existe una categoría con ese nombre" }
  refresh()
  return { ok: true }
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(categories).where(eq(categories.id, id))
  refresh()
  return { ok: true }
}

export async function deleteMerchantRule(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(merchantRules).where(eq(merchantRules.id, id))
  refresh()
  return { ok: true }
}

// --- Cuentas fijas --------------------------------------------------------

const fixedBillSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  categoryId: z.coerce.number().int().positive("Elegí una categoría"),
  pattern: z.string().trim().max(60).optional(),
  expectedAmount: z.string().optional(),
  dueDay: z.string().optional(),
})

export async function createFixedBill(formData: FormData): Promise<ActionResult> {
  await requireSession()
  const parsed = fixedBillSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  let expectedAmount: string | null = null
  if (d.expectedAmount?.trim()) {
    const amount = parseAmount(d.expectedAmount)
    if (amount === null) return { ok: false, error: "Monto estimado inválido" }
    expectedAmount = amount.toFixed(2)
  }

  let dueDay: number | null = null
  if (d.dueDay?.trim()) {
    dueDay = Number(d.dueDay)
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return { ok: false, error: "El día de vencimiento va de 1 a 31" }
    }
  }

  await db.insert(fixedBills).values({
    name: d.name,
    categoryId: d.categoryId,
    pattern: d.pattern || null,
    expectedAmount,
    dueDay,
  })
  refresh()
  return { ok: true }
}

const payBillSchema = z.object({
  billId: z.number().int().positive(),
  amount: z.string().min(1, "Ingresá un monto"),
  source: z.enum(txSourceEnum.enumValues),
})

/** Registra el pago de una cuenta fija con un toque: crea el gasto ya vinculado. */
export async function payFixedBill(input: { billId: number; amount: string; source: string }): Promise<ActionResult> {
  await requireSession()
  const parsed = payBillSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const amount = parseAmount(parsed.data.amount)
  if (amount === null) return { ok: false, error: "Monto inválido" }

  const [bill] = await db.select().from(fixedBills).where(eq(fixedBills.id, parsed.data.billId))
  if (!bill) return { ok: false, error: "Esa cuenta fija ya no existe" }

  await db.insert(transactions).values({
    amount: amount.toFixed(2),
    type: "expense",
    source: parsed.data.source,
    merchant: bill.name,
    description: "Cuenta fija",
    categoryId: bill.categoryId,
    fixedBillId: bill.id,
    occurredAt: new Date(),
  })
  refresh()
  return { ok: true }
}

export async function deleteFixedBill(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(fixedBills).where(eq(fixedBills.id, id))
  refresh()
  return { ok: true }
}

// --- Saldo y cierre de mes ------------------------------------------------

export async function setOpeningBalance(month: string, raw: string): Promise<ActionResult> {
  await requireSession()
  if (!isValidMonth(month)) return { ok: false, error: "Mes inválido" }

  let openingBalance: string | null = null
  if (raw.trim()) {
    const negative = raw.trim().startsWith("-")
    const amount = parseAmount(raw)
    if (amount === null && raw.replace(/[^d]/g, "") !== "0") {
      return { ok: false, error: "Monto inválido" }
    }
    openingBalance = ((negative ? -1 : 1) * (amount ?? 0)).toFixed(2)
  }

  await db
    .insert(monthBalances)
    .values({ month, openingBalance })
    .onConflictDoUpdate({ target: monthBalances.month, set: { openingBalance } })
  refresh()
  return { ok: true }
}

const allocationSchema = z.array(
  z.object({ goalId: z.number().int().positive(), amount: z.number().positive(), usd: z.number().positive().optional() })
)

/** Reparte lo que sobró del mes en sobres y marca el mes como cerrado. */
export async function closeMonth(
  month: string,
  allocations: { goalId: number; amount: number; usd?: number }[]
): Promise<ActionResult> {
  await requireSession()
  if (!isValidMonth(month)) return { ok: false, error: "Mes inválido" }
  const parsed = allocationSchema.safeParse(allocations)
  if (!parsed.success) return { ok: false, error: "Montos inválidos" }

  if (parsed.data.length > 0) {
    await db.insert(savingsMovements).values(
      parsed.data.map((a) => ({
        goalId: a.goalId,
        month,
        amount: a.amount.toFixed(2),
        usd: a.usd ? a.usd.toFixed(2) : null,
        note: "Cierre de mes",
      }))
    )
  }
  await db
    .insert(monthBalances)
    .values({ month, closedAt: new Date() })
    .onConflictDoUpdate({ target: monthBalances.month, set: { closedAt: new Date() } })
  refresh()
  return { ok: true }
}

export async function reopenMonth(month: string): Promise<ActionResult> {
  await requireSession()
  await db.update(monthBalances).set({ closedAt: null }).where(eq(monthBalances.month, month))
  refresh()
  return { ok: true }
}

// --- Sobres de ahorro -----------------------------------------------------

const goalSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(40),
  emoji: z.string().trim().min(1).max(8).default("💰"),
  target: z.string().optional(),
  isUsd: z.string().optional(),
})

export async function createSavingsGoal(formData: FormData): Promise<ActionResult> {
  await requireSession()
  const parsed = goalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  let target: string | null = null
  if (d.target?.trim()) {
    const amount = parseAmount(d.target)
    if (amount === null) return { ok: false, error: "Meta inválida" }
    target = amount.toFixed(2)
  }

  const inserted = await db
    .insert(savingsGoals)
    .values({ name: d.name, emoji: d.emoji, target, isUsd: d.isUsd === "on" })
    .onConflictDoNothing()
    .returning()
  if (inserted.length === 0) return { ok: false, error: "Ya existe un sobre con ese nombre" }
  refresh()
  return { ok: true }
}

export async function updateSavingsTarget(id: number, raw: string): Promise<ActionResult> {
  await requireSession()
  let target: string | null = null
  if (raw.trim()) {
    const amount = parseAmount(raw)
    if (amount === null) return { ok: false, error: "Meta inválida" }
    target = amount.toFixed(2)
  }
  await db.update(savingsGoals).set({ target }).where(eq(savingsGoals.id, id))
  refresh()
  return { ok: true }
}

export async function deleteSavingsGoal(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id))
  refresh()
  return { ok: true }
}

const savingsMoveSchema = z.object({
  goalId: z.coerce.number().int().positive(),
  kind: z.enum(["deposit", "withdraw"]),
  amount: z.string().min(1, "Ingresá un monto"),
  usd: z.string().optional(),
  note: z.string().trim().max(200).optional(),
})

/** Depositar o retirar de un sobre. Afecta el disponible del mes actual. */
export async function moveSavings(formData: FormData): Promise<ActionResult> {
  await requireSession()
  const parsed = savingsMoveSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const amount = parseAmount(d.amount)
  if (amount === null) return { ok: false, error: "Monto inválido" }
  let usd: number | null = null
  if (d.usd?.trim()) {
    usd = parseAmount(d.usd)
    if (usd === null) return { ok: false, error: "Monto en dólares inválido" }
  }
  const sign = d.kind === "deposit" ? 1 : -1

  await db.insert(savingsMovements).values({
    goalId: d.goalId,
    month: currentMonth(),
    amount: (sign * amount).toFixed(2),
    usd: usd === null ? null : (sign * usd).toFixed(2),
    note: d.note ?? "",
  })
  refresh()
  return { ok: true }
}

export async function deleteSavingsMovement(id: number): Promise<ActionResult> {
  await requireSession()
  await db.delete(savingsMovements).where(eq(savingsMovements.id, id))
  refresh()
  return { ok: true }
}
