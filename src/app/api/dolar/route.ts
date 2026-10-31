import { NextResponse, type NextRequest } from "next/server"
import { and, gte, inArray, lt, sql } from "drizzle-orm"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { safeEqual } from "@/lib/auth"
import { arDate } from "@/lib/dates"
import { ensureRates, getQuotes, getUsdKind } from "@/lib/fx"
import { OUTGOING_TYPES } from "@/lib/labels"
import { formatUSD } from "@/lib/money"

export const dynamic = "force-dynamic"

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function change(value: number | null) {
  if (value === null || Math.abs(value) < 0.05) return ""
  return ` ${value > 0 ? "▲" : "▼"}${pct.format(Math.abs(value))}%`
}

/**
 * Texto listo para mostrar como notificación desde un Atajo de iOS:
 *   💵 MEP $ 1.575 ▲0,8%
 *   Blue $ 1.565 · Cripto $ 1.654 · Oficial $ 1.560
 *   Hoy gastaste $ 12.500 (≈ US$ 7,94)
 * Con `?format=json` devuelve los datos crudos.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.INGEST_TOKEN
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  if (!expected || !token || !(await safeEqual(token, expected))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  await ensureRates()
  const today = arDate()
  const [quotes, usdKind, [spentRow]] = await Promise.all([
    getQuotes(),
    getUsdKind(),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          inArray(transactions.type, OUTGOING_TYPES),
          gte(transactions.occurredAt, new Date(`${today}T00:00:00-03:00`)),
          lt(transactions.occurredAt, new Date(new Date(`${today}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000))
        )
      ),
  ])

  const main = quotes.find((q) => q.kind === usdKind) ?? quotes[0]
  if (!main) {
    return new NextResponse("💵 No pude conseguir la cotización del dólar. Probá en un rato.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  const spent = Number(spentRow?.total ?? 0)

  if (req.nextUrl.searchParams.get("format") === "json") {
    return NextResponse.json({ reference: main.kind, quotes, spentToday: spent, spentTodayUsd: spent / main.sell })
  }

  const lines = [
    `💵 ${main.label} ${ars.format(main.sell)}${change(main.changePct)}`,
    quotes
      .filter((q) => q.kind !== main.kind)
      .map((q) => `${q.label} ${ars.format(q.sell)}`)
      .join(" · "),
    spent > 0
      ? `Hoy gastaste ${ars.format(spent)} (≈ ${formatUSD(spent / main.sell)})`
      : "Hoy no registraste gastos",
  ]
  return new NextResponse(lines.filter(Boolean).join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
