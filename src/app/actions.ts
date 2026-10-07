"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  categories,
  merchantRules,
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
import { fromLocalInputValue } from "@/lib/dates"
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
})

function parseTxForm(formData: FormData) {
  const parsed = txSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" } as const

  const d = parsed.data
  const amount = parseAmount(d.amount)
  if (amount === null) return { error: "Monto inválido" } as const

  const categoryId = d.categoryId && d.categoryId !== "none" ? Number(d.categoryId) : null
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
