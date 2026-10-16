import "server-only"
import { asc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { monthBalances, savingsGoals, savingsMovements, transactions } from "@/db/schema"
import { shiftMonth } from "@/lib/dates"

const arMonth = sql<string>`to_char(${transactions.occurredAt} at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM')`

export type MonthBalance = {
  month: string
  opening: number
  /** true si el saldo inicial se cargó a mano (si no, viene del cierre anterior). */
  openingIsManual: boolean
  income: number
  spent: number
  /** Neto apartado en sobres este mes (depósitos − retiros). */
  saved: number
  /** Disponible al final del mes = opening + income − spent − saved. */
  closing: number
  closedAt: Date | null
}

/**
 * Calcula el saldo de cada mes, arrastrando el cierre del mes anterior.
 * Arranca en el primer mes con datos (o con saldo cargado) y llega hasta \`upTo\`.
 */
export async function getBalances(upTo: string): Promise<Map<string, MonthBalance>> {
  const [flows, saved, manual] = await Promise.all([
    db
      .select({
        month: arMonth,
        income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} in ('income', 'transfer_in')), 0)`,
        spent: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} in ('expense', 'transfer_out')), 0)`,
      })
      .from(transactions)
      .groupBy(arMonth),
    db
      .select({ month: savingsMovements.month, saved: sql<string>`sum(${savingsMovements.amount})` })
      .from(savingsMovements)
      .groupBy(savingsMovements.month),
    db.select().from(monthBalances).orderBy(asc(monthBalances.month)),
  ])

  const flowBy = new Map(flows.map((f) => [f.month, f]))
  const savedBy = new Map(saved.map((s) => [s.month, Number(s.saved)]))
  const manualBy = new Map(manual.map((m) => [m.month, m]))

  const months = [...flowBy.keys(), ...savedBy.keys(), ...manualBy.keys()].filter((m) => m <= upTo).sort()
  const result = new Map<string, MonthBalance>()
  if (months.length === 0) return result

  let prevClosing = 0
  for (let m = months[0]; m <= upTo; m = shiftMonth(m, 1)) {
    const row = manualBy.get(m)
    const manualOpening = row?.openingBalance != null ? Number(row.openingBalance) : null
    const opening = manualOpening ?? prevClosing
    const income = Number(flowBy.get(m)?.income ?? 0)
    const spent = Number(flowBy.get(m)?.spent ?? 0)
    const savedNet = savedBy.get(m) ?? 0
    const closing = opening + income - spent - savedNet
    result.set(m, {
      month: m,
      opening,
      openingIsManual: manualOpening !== null,
      income,
      spent,
      saved: savedNet,
      closing,
      closedAt: row?.closedAt ?? null,
    })
    prevClosing = closing
  }
  return result
}

export async function getMonthBalance(month: string): Promise<MonthBalance> {
  const all = await getBalances(month)
  return (
    all.get(month) ?? {
      month,
      opening: 0,
      openingIsManual: false,
      income: 0,
      spent: 0,
      saved: 0,
      closing: 0,
      closedAt: null,
    }
  )
}

/** Sobres con su saldo en pesos (y en dólares, si corresponde). */
export async function getSavingsGoals() {
  const rows = await db
    .select({
      goal: savingsGoals,
      balance: sql<string>`coalesce(sum(${savingsMovements.amount}), 0)`,
      usd: sql<string>`coalesce(sum(${savingsMovements.usd}), 0)`,
    })
    .from(savingsGoals)
    .leftJoin(savingsMovements, eq(savingsMovements.goalId, savingsGoals.id))
    .groupBy(savingsGoals.id)
    .orderBy(asc(savingsGoals.id))

  return rows.map((r) => ({
    ...r.goal,
    target: r.goal.target === null ? null : Number(r.goal.target),
    balance: Number(r.balance),
    usd: Number(r.usd),
  }))
}

export type SavingsGoalWithBalance = Awaited<ReturnType<typeof getSavingsGoals>>[number]

export async function getSavingsMovements(goalId?: number, limit = 30) {
  return db
    .select({
      id: savingsMovements.id,
      month: savingsMovements.month,
      amount: savingsMovements.amount,
      usd: savingsMovements.usd,
      note: savingsMovements.note,
      createdAt: savingsMovements.createdAt,
      goalName: savingsGoals.name,
      goalEmoji: savingsGoals.emoji,
    })
    .from(savingsMovements)
    .innerJoin(savingsGoals, eq(savingsGoals.id, savingsMovements.goalId))
    .where(goalId ? eq(savingsMovements.goalId, goalId) : undefined)
    .orderBy(sql`${savingsMovements.createdAt} desc`)
    .limit(limit)
}
