import "server-only"
import { and, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm"
import { db } from "@/db"
import {
  categories,
  fixedBills,
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

/** Cuentas fijas con el pago (si existe) que las cubre en el mes indicado. */
export async function getFixedBillsStatus(month: string) {
  const { start, end } = monthRange(month)
  const rows = await db.execute<{
    id: number
    name: string
    pattern: string | null
    expected_amount: string | null
    due_day: number | null
    category_id: number
    category_name: string
    category_emoji: string
    paid_amount: string | null
    paid_at: string | null
    last_source: TxSource | null
  }>(sql`
    select b.id, b.name, b.pattern, b.expected_amount, b.due_day, b.category_id,
           c.name as category_name, c.emoji as category_emoji,
           p.amount as paid_amount, p.occurred_at as paid_at, ls.source as last_source
    from ${fixedBills} b
    join ${categories} c on c.id = b.category_id
    left join lateral (
      select sum(t.amount) as amount, max(t.occurred_at) as occurred_at
      from ${transactions} t
      where t.fixed_bill_id = b.id
        and t.occurred_at >= ${start.toISOString()} and t.occurred_at < ${end.toISOString()}
      having count(*) > 0
    ) p on true
    left join lateral (
      select t.source from ${transactions} t
      where t.fixed_bill_id = b.id
      order by t.occurred_at desc
      limit 1
    ) ls on true
    order by coalesce(b.due_day, 99), b.name
  `)

  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    pattern: r.pattern,
    expectedAmount: r.expected_amount === null ? null : Number(r.expected_amount),
    dueDay: r.due_day,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryEmoji: r.category_emoji,
    paidAmount: r.paid_amount === null ? null : Number(r.paid_amount),
    paidAt: r.paid_at === null ? null : new Date(r.paid_at),
    lastSource: r.last_source,
  }))
}

export type FixedBillStatus = Awaited<ReturnType<typeof getFixedBillsStatus>>[number]

/** Cuenta fija sin pagar este mes cuyo nombre (o pattern) es el comienzo del comercio. */
export async function fixedBillForMerchant(merchant: string | null | undefined, when: Date) {
  if (!merchant) return null
  const month = new Date(when.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7)
  const { start, end } = monthRange(month)
  const [row] = await db
    .select({ id: fixedBills.id, categoryId: fixedBills.categoryId })
    .from(fixedBills)
    .where(
      sql`lower(${merchant}) like lower(coalesce(${fixedBills.pattern}, ${fixedBills.name})) || '%'
        and not exists (
          select 1 from ${transactions} t
          where t.fixed_bill_id = ${fixedBills.id}
            and t.occurred_at >= ${start.toISOString()} and t.occurred_at < ${end.toISOString()}
        )`
    )
    .orderBy(desc(sql`length(coalesce(${fixedBills.pattern}, ${fixedBills.name}))`))
    .limit(1)
  return row ?? null
}

/** Lista simple de cuentas fijas, para selectores. */
export async function getFixedBillOptions() {
  return db
    .select({ id: fixedBills.id, name: fixedBills.name, categoryId: fixedBills.categoryId })
    .from(fixedBills)
    .orderBy(fixedBills.name)
}

export type FixedBillOption = Awaited<ReturnType<typeof getFixedBillOptions>>[number]
