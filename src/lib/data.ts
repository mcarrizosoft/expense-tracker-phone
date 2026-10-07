import "server-only"
import { and, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm"
import { db } from "@/db"
import {
  categories,
  merchantRules,
  transactions,
  type TxSource,
} from "@/db/schema"
import { monthRange } from "@/lib/dates"

export async function getCategories() {
  return db.select().from(categories).orderBy(categories.name)
}

export async function getMerchantRules() {
  return db
    .select({
      id: merchantRules.id,
      pattern: merchantRules.pattern,
      categoryName: categories.name,
      categoryEmoji: categories.emoji,
    })
    .from(merchantRules)
    .innerJoin(categories, eq(merchantRules.categoryId, categories.id))
    .orderBy(merchantRules.pattern)
}

/** Busca una regla cuyo patrón esté contenido en el nombre del comercio. */
export async function categoryForMerchant(merchant: string | null | undefined) {
  if (!merchant) return null
  const [rule] = await db
    .select({ categoryId: merchantRules.categoryId })
    .from(merchantRules)
    .where(sql`${merchant} ilike '%' || ${merchantRules.pattern} || '%'`)
    .orderBy(desc(sql`length(${merchantRules.pattern})`))
    .limit(1)
  return rule?.categoryId ?? null
}

export async function categoryIdByName(name: string | undefined) {
  if (!name) return null
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name.trim()})`)
    .limit(1)
  return row?.id ?? null
}

const outgoing = sql`${transactions.type} in ('expense', 'transfer_out')`
const incoming = sql`${transactions.type} in ('income', 'transfer_in')`

export async function getMonthSummary(month: string) {
  const { start, end } = monthRange(month)
  const inMonth = and(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end))

  const [totals, byCategory, bySource, pending] = await Promise.all([
    db
      .select({
        out: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${outgoing}), 0)`,
        in: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${incoming}), 0)`,
        count: count(),
      })
      .from(transactions)
      .where(inMonth),
    db
      .select({
        categoryId: transactions.categoryId,
        name: sql<string>`coalesce(${categories.name}, 'Sin categoría')`,
        emoji: sql<string>`coalesce(${categories.emoji}, '❔')`,
        color: sql<string>`coalesce(${categories.color}, '#a3a3a3')`,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(inMonth, outgoing))
      .groupBy(transactions.categoryId, categories.name, categories.emoji, categories.color)
      .orderBy(desc(sql`sum(${transactions.amount})`)),
    db
      .select({
        source: transactions.source,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(inMonth, outgoing))
      .groupBy(transactions.source)
      .orderBy(desc(sql`sum(${transactions.amount})`)),
    db
      .select({ count: count() })
      .from(transactions)
      .where(eq(transactions.needsReview, true)),
  ])

  const out = Number(totals[0].out)
  const inc = Number(totals[0].in)
  return {
    out,
    in: inc,
    balance: inc - out,
    count: totals[0].count,
    pending: pending[0].count,
    byCategory: byCategory.map((r) => ({ ...r, total: Number(r.total) })),
    bySource: bySource.map((r) => ({ ...r, total: Number(r.total) })),
  }
}

export type TransactionFilters = {
  month: string
  source?: TxSource
  categoryId?: number | "none"
  pendingOnly?: boolean
  limit?: number
}

export async function getTransactions(f: TransactionFilters) {
  const { start, end } = monthRange(f.month)
  const where: SQL[] = []
  if (f.pendingOnly) {
    where.push(eq(transactions.needsReview, true))
  } else {
    where.push(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end))
  }
  if (f.source) where.push(eq(transactions.source, f.source))
  if (f.categoryId === "none") where.push(sql`${transactions.categoryId} is null`)
  else if (f.categoryId) where.push(eq(transactions.categoryId, f.categoryId))

  const rows = await db
    .select({
      tx: transactions,
      category: categories,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...where))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(f.limit ?? 500)

  return rows.map((r) => ({ ...r.tx, category: r.category }))
}

export type TransactionWithCategory = Awaited<ReturnType<typeof getTransactions>>[number]
