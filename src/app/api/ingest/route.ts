import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { transactions, txSourceEnum, txTypeEnum } from "@/db/schema"
import { safeEqual } from "@/lib/auth"
import { categoryForMerchant, categoryIdByName } from "@/lib/data"
import { isOutgoing } from "@/lib/labels"
import { parseAmount } from "@/lib/money"

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    console.warn("[ingest] cuerpo no es JSON")
    return NextResponse.json({ error: "El cuerpo debe ser JSON" }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    const issues = z.flattenError(parsed.error).fieldErrors
    console.warn("[ingest] datos inválidos", JSON.stringify({ body, issues }))
    return NextResponse.json(
      { error: "Datos inválidos", issues },
      { status: 400 }
    )
  }
  const data = parsed.data
  if (data.source === "other") {
    const raw = (body as Record<string, unknown>)?.source
    console.warn("[ingest] medio no reconocido, se guarda como 'other':", JSON.stringify(raw ?? null))
  }

  const amount = parseAmount(data.amount)
  if (amount === null) {
    console.warn("[ingest] monto inválido", JSON.stringify(body))
    return NextResponse.json({ error: `Monto inválido: ${data.amount}` }, { status: 400 })
  }

  let occurredAt = new Date()
  if (data.occurredAt) {
    const d = new Date(data.occurredAt)
    if (!Number.isNaN(d.getTime())) occurredAt = d
  }

  const categoryId =
    (await categoryIdByName(data.category)) ?? (await categoryForMerchant(data.merchant))

  const [row] = await db
    .insert(transactions)
    .values({
      amount: amount.toFixed(2),
      type: data.type,
      source: data.source,
      merchant: data.merchant ?? null,
      description: data.description ?? "",
      categoryId,
      occurredAt,
      needsReview: categoryId === null && isOutgoing(data.type),
    })
    .returning({ id: transactions.id })

  revalidatePath("/", "layout")
  return NextResponse.json({ id: row.id, amount, categorized: categoryId !== null }, { status: 201 })
}
