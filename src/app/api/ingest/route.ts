import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { eq } from "drizzle-orm"
import { categories, transactions, txSourceEnum, txTypeEnum } from "@/db/schema"
import { safeEqual } from "@/lib/auth"
import { categoryForMerchant, categoryIdByName, fixedBillForMerchant } from "@/lib/data"
import { getMonthBalance } from "@/lib/balance"
import { currentMonth } from "@/lib/dates"
import { TYPE_LABELS, isOutgoing } from "@/lib/labels"
import { formatARS, parseAmount } from "@/lib/money"

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : undefined))

/** Atajos a veces agrega espacios, saltos de línea, mayúsculas o tildes a los textos. */
function clean(v: unknown) {
  if (typeof v !== "string") return v
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
  return s || undefined
}

/** Acepta los códigos ("expense") o las opciones del menú en castellano ("Pagué / compré"). */
function toType(v: unknown) {
  const s = clean(v)
  if (typeof s !== "string" || (txTypeEnum.enumValues as string[]).includes(s)) return s
  if (/mis cuentas|entre cuentas|cuenta propia|movi entre|pase entre/.test(s)) return "internal"
  if (/recib|cobr|ingres|sueldo/.test(s)) return /transf/.test(s) ? "transfer_in" : "income"
  if (/transf|envi/.test(s)) return "transfer_out"
  if (/pag|compr|gast/.test(s)) return "expense"
  return s
}

/** Acepta "mercadopago", "Mercado Pago", "Banco Galicia", "Apple Pay", etc. */
function toSource(v: unknown) {
  const s = clean(v)
  if (typeof s !== "string") return s
  const compact = s.replace(/[^a-z]/g, "")
  if (compact.includes("mercadopago")) return "mercadopago"
  if (compact.includes("galicia")) return "galicia"
  if (compact.includes("lemon")) return "lemon"
  if (compact.includes("applepay") || compact.includes("wallet")) return "apple_pay"
  return (txSourceEnum.enumValues as string[]).includes(s) ? s : "other"
}

/**
 * Sin `type` (ej: MacroDroid, que solo pregunta monto y detalle), se deduce
 * del detalle: "recibí sueldo" → ingreso, "a mis cuentas" → entre cuentas.
 */
function inferType(detail: unknown) {
  const s = clean(detail)
  if (typeof s !== "string") return "expense"
  if (/mis cuentas|entre cuentas|cuenta propia/.test(s)) return "internal"
  if (/^(recib|cobr|me pagaron|me devolv|me transfir|ingreso|sueldo)/.test(s)) return "income"
  return "expense"
}

/** Acepta JSON (Atajos de iOS) y/o parámetros en la URL (MacroDroid en Android). */
async function readPayload(req: NextRequest): Promise<Record<string, unknown> | null> {
  const params: Record<string, unknown> = Object.fromEntries(req.nextUrl.searchParams)
  delete params.format
  const text = await req.text()
  if (!text.trim()) return params
  try {
    const json = JSON.parse(text)
    return json && typeof json === "object" ? { ...params, ...json } : null
  } catch {
    return null
  }
}

const payloadSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  type: z.preprocess(toType, z.enum(txTypeEnum.enumValues).default("expense")),
  source: z.preprocess(toSource, z.enum(txSourceEnum.enumValues).default("other")),
  merchant: optionalText,
  description: optionalText,
  category: optionalText,
  occurredAt: optionalText,
})

export async function POST(req: NextRequest) {
  const expected = process.env.INGEST_TOKEN
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  if (!expected || !token || !(await safeEqual(token, expected))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const asText = req.nextUrl.searchParams.get("format") === "text"
  const body = await readPayload(req)
  if (!body) {
    console.warn("[ingest] cuerpo no es JSON")
    return reply(asText, 400, { error: "El cuerpo debe ser JSON" }, "⚠️ No se pudo leer lo que mandaste")
  }
  if (body.type == null || body.type === "") body.type = inferType(body.merchant ?? body.description)

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    const issues = z.flattenError(parsed.error).fieldErrors
    console.warn("[ingest] datos inválidos", JSON.stringify({ body, issues }))
    return reply(asText, 400, { error: "Datos inválidos", issues }, "⚠️ Faltan datos: revisá el monto")
  }
  const data = parsed.data
  if (data.source === "other") {
    const raw = body.source
    console.warn("[ingest] medio no reconocido, se guarda como 'other':", JSON.stringify(raw ?? null))
  }

  const amount = parseAmount(data.amount)
  if (amount === null) {
    console.warn("[ingest] monto inválido", JSON.stringify(body))
    return reply(asText, 400, { error: `Monto inválido: ${data.amount}` }, `⚠️ Monto inválido: ${data.amount}`)
  }

  let occurredAt = new Date()
  if (data.occurredAt) {
    const d = new Date(data.occurredAt)
    if (!Number.isNaN(d.getTime())) occurredAt = d
  }

  const bill = isOutgoing(data.type) ? await fixedBillForMerchant(data.merchant, occurredAt) : null
  const categoryId =
    (await categoryIdByName(data.category)) ??
    (await categoryForMerchant(data.merchant)) ??
    bill?.categoryId ??
    null

  const [row] = await db
    .insert(transactions)
    .values({
      amount: amount.toFixed(2),
      type: data.type,
      source: data.source,
      merchant: data.merchant ?? null,
      description: data.description ?? "",
      categoryId,
      fixedBillId: bill?.id ?? null,
      occurredAt,
      needsReview: categoryId === null && isOutgoing(data.type),
    })
    .returning({ id: transactions.id })

  revalidatePath("/", "layout")

  const [category, balance] = await Promise.all([
    categoryId
      ? db.select({ name: categories.name, emoji: categories.emoji }).from(categories).where(eq(categories.id, categoryId))
      : Promise.resolve([]),
    getMonthBalance(currentMonth()),
  ])
  const cat = category[0]
  const message = [
    `✓ ${TYPE_LABELS[data.type]} ${formatARS(amount)}${data.merchant ? ` · ${data.merchant}` : ""}`,
    cat ? `${cat.emoji} ${cat.name}` : isOutgoing(data.type) ? "Sin categoría: elegila en la app" : null,
    `Disponible: ${formatARS(balance.closing)}`,
  ]
    .filter(Boolean)
    .join("\n")

  return reply(asText, 201, { id: row.id, amount, categorized: categoryId !== null, message }, message)
}

/** JSON por defecto; texto plano con `?format=text` (para mostrarlo directo como notificación). */
function reply(asText: boolean, status: number, json: object, text: string) {
  return asText
    ? new NextResponse(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    : NextResponse.json(json, { status })
}
