import { config } from "dotenv"
config({ path: [".env.local", ".env"], quiet: true })
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { categories } from "../src/db/schema"

const db = drizzle(neon(process.env.DATABASE_URL!))

const defaults = [
  { name: "Comida", emoji: "🍔", color: "#f97316" },
  { name: "Super", emoji: "🛒", color: "#22c55e" },
  { name: "Transporte", emoji: "🚕", color: "#3b82f6" },
  { name: "Servicios", emoji: "💡", color: "#eab308" },
  { name: "Salidas", emoji: "🍻", color: "#a855f7" },
  { name: "Salud", emoji: "💊", color: "#ef4444" },
  { name: "Suscripciones", emoji: "📺", color: "#06b6d4" },
  { name: "Otros", emoji: "💸", color: "#737373" },
]

async function main() {
  await db.insert(categories).values(defaults).onConflictDoNothing()
  console.log(`Categorías cargadas (${defaults.length})`)
}

main()
