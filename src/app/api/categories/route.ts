import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/db"
import { categories, merchantRules } from "@/db/schema"
import { safeEqual } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Categorías y reglas por comercio, para que una app externa (Gastito en Android)
 * muestre las categorías y sugiera una mientras se escribe el detalle.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.INGEST_TOKEN
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  if (!expected || !token || !(await safeEqual(token, expected))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [cats, rules] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, emoji: categories.emoji, color: categories.color })
      .from(categories)
      .orderBy(categories.name),
    db.select({ pattern: merchantRules.pattern, categoryId: merchantRules.categoryId }).from(merchantRules),
  ])

  return NextResponse.json({ categories: cats, rules }, { headers: { "Cache-Control": "no-store" } })
}
