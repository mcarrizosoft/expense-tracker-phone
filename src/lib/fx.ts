import "server-only"
import { and, asc, eq, gte, sql } from "drizzle-orm"
import { db } from "@/db"
import { appSettings, fxRates, transactions } from "@/db/schema"
import { arDate, monthRange } from "@/lib/dates"
import { DEFAULT_USD_KIND, USD_KINDS, USD_KIND_LABELS, isUsdKind, type UsdKind } from "@/lib/labels"

const DAY = 24 * 60 * 60 * 1000
const TODAY_MAX_AGE = 30 * 60 * 1000
const FETCH_TIMEOUT = 6000

type RateRow = { kind: string; date: string; buy: number; sell: number }

// --- Preferencia ------------------------------------------------------------

export async function getUsdKind(): Promise<UsdKind> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "usd_kind"))
  return isUsdKind(row?.value) ? row.value : DEFAULT_USD_KIND
}

// --- Actualización ----------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return res.json() as Promise<T>
}

async function upsertRates(rows: RateRow[]) {
  if (rows.length === 0) return
  await db
    .insert(fxRates)
    .values(rows.map((r) => ({ ...r, buy: r.buy.toFixed(2), sell: r.sell.toFixed(2) })))
    .onConflictDoUpdate({
      target: [fxRates.kind, fxRates.date],
      set: { buy: sql`excluded.buy`, sell: sql`excluded.sell`, updatedAt: sql`now()` },
    })
}

/** Cotización actual (DolarAPI), guardada como la de hoy. */
async function refreshToday(today: string) {
  const data = await fetchJson<{ casa: string; compra: number; venta: number }[]>(
    "https://dolarapi.com/v1/dolares"
  )
  await upsertRates(
    data
      .filter((d) => isUsdKind(d.casa) && d.venta > 0)
      .map((d) => ({ kind: d.casa, date: today, buy: d.compra, sell: d.venta }))
  )
}

/** Historial diario (ArgentinaDatos) desde `from`, sin incluir hoy. */
async function backfill(from: string, today: string) {
  const histories = await Promise.all(
    USD_KINDS.map((kind) =>
      fetchJson<{ casa: string; compra: number; venta: number; fecha: string }[]>(
        `https://api.argentinadatos.com/v1/cotizaciones/dolares/${kind}`
      )
    )
  )
  await upsertRates(
    histories
      .flat()
      .filter((d) => d.fecha >= from && d.fecha < today && d.venta > 0)
      .map((d) => ({ kind: d.casa, date: d.fecha, buy: d.compra || d.venta, sell: d.venta }))
  )
}

let lastCheck = 0

/**
 * Se asegura de tener la cotización de hoy (máx. 30 min de antigüedad) y el
 * historial desde el primer movimiento. Si las APIs fallan, sigue con lo guardado.
 */
export async function ensureRates() {
  if (Date.now() - lastCheck < 5 * 60 * 1000) return
  lastCheck = Date.now()

  const today = arDate()
  try {
    const [[state], [first]] = await Promise.all([
      db
        .select({
          minDate: sql<string | null>`min(${fxRates.date})`,
          maxPastDate: sql<string | null>`max(${fxRates.date}) filter (where ${fxRates.date} < ${today})`,
          todayUpdated: sql<string | null>`max(${fxRates.updatedAt}) filter (where ${fxRates.date} = ${today})`,
        })
        .from(fxRates),
      db
        .select({
          date: sql<string | null>`to_char(min(${transactions.occurredAt}) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')`,
        })
        .from(transactions),
    ])

    // Una semana antes del primer movimiento, para cubrir fines de semana y feriados.
    const neededFrom = arDate(new Date(new Date(`${first.date ?? today}T12:00:00Z`).getTime() - 7 * DAY))
    const yesterday = arDate(new Date(Date.now() - DAY))

    if (!state.minDate || state.minDate > neededFrom) {
      await backfill(neededFrom, today)
    } else if (!state.maxPastDate || state.maxPastDate < yesterday) {
      await backfill(state.maxPastDate ?? neededFrom, today)
    }

    const fresh = state.todayUpdated && Date.now() - new Date(state.todayUpdated).getTime() < TODAY_MAX_AGE
    if (!fresh) await refreshToday(today)
  } catch (err) {
    console.warn("[fx] no se pudo actualizar la cotización:", err instanceof Error ? err.message : err)
  }
}

// --- Consultas --------------------------------------------------------------

export type UsdQuote = {
  kind: UsdKind
  label: string
  date: string
  buy: number
  sell: number
  /** Variación de la venta contra el día anterior guardado, en %. */
  changePct: number | null
}

/** Última cotización de cada tipo de dólar, en el orden de USD_KINDS. */
export async function getQuotes(): Promise<UsdQuote[]> {
  const rows = await db
    .select()
    .from(fxRates)
    .where(gte(fxRates.date, arDate(new Date(Date.now() - 15 * DAY))))
    .orderBy(asc(fxRates.date))

  return USD_KINDS.flatMap((kind) => {
    const series = rows.filter((r) => r.kind === kind)
    const last = series.at(-1)
    if (!last) return []
    const prev = series.at(-2)
    const sell = Number(last.sell)
    return [
      {
        kind,
        label: USD_KIND_LABELS[kind],
        date: last.date,
        buy: Number(last.buy),
        sell,
        changePct: prev ? ((sell - Number(prev.sell)) / Number(prev.sell)) * 100 : null,
      },
    ]
  })
}

/**
 * Devuelve una función que da la cotización (venta) de un día: la de esa fecha
 * o, si no hay (feriado, sin datos), la última anterior.
 */
export async function getRateLookup(kind: UsdKind, from: string) {
  const rows = await db
    .select({ date: fxRates.date, sell: fxRates.sell })
    .from(fxRates)
    .where(and(eq(fxRates.kind, kind), gte(fxRates.date, arDate(new Date(new Date(`${from}T12:00:00Z`).getTime() - 15 * DAY)))))
    .orderBy(asc(fxRates.date))
  const dates = rows.map((r) => r.date)
  const sells = rows.map((r) => Number(r.sell))

  return (date: string | Date): number | null => {
    const d = typeof date === "string" ? date : arDate(date)
    let lo = 0
    let hi = dates.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (dates[mid] <= d) {
        found = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return found === -1 ? null : sells[found]
  }
}

export type RateLookup = Awaited<ReturnType<typeof getRateLookup>>

/** Agrega `usd` a cada movimiento, convertido con el dólar del día en que ocurrió. */
export function withUsd<T extends { amount: string; occurredAt: Date }>(items: T[], rateOn: RateLookup) {
  return items.map((t) => {
    const rate = rateOn(t.occurredAt)
    return { ...t, usd: rate ? Number(t.amount) / rate : null }
  })
}

/** Gastos e ingresos de cada mes en dólares, cada movimiento al dólar de su día. */
export async function getUsdFlows(kind: UsdKind, fromMonth: string, toMonth: string) {
  const start = monthRange(fromMonth).start
  const end = monthRange(toMonth).end
  const res = await db.execute<{ month: string; spent: string | null; income: string | null }>(sql`
    select
      to_char(t.occurred_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM') as month,
      sum(t.amount / r.sell) filter (where t.type in ('expense', 'transfer_out')) as spent,
      sum(t.amount / r.sell) filter (where t.type in ('income', 'transfer_in')) as income
    from transactions t
    left join lateral (
      select f.sell from fx_rates f
      where f.kind = ${kind}
        and f.date <= to_char(t.occurred_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
      order by f.date desc
      limit 1
    ) r on true
    where t.occurred_at >= ${start.toISOString()} and t.occurred_at < ${end.toISOString()}
    group by 1
  `)
  return new Map(
    res.rows.map((r) => [r.month, { spent: Number(r.spent ?? 0), income: Number(r.income ?? 0) }])
  )
}
