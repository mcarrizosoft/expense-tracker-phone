import { config } from "dotenv"
config({ path: [".env.local", ".env"], quiet: true })
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { categories } from "../src/db/schema"

const db = drizzle(neon(process.env.DATABASE_URL!))

const defaults = [
  { name: "Comer afuera", emoji: "🍔", color: "#f97316" },
  { name: "Super y almacén", emoji: "🛒", color: "#22c55e" },
  { name: "Alquiler", emoji: "🏠", color: "#0ea5e9" },
  { name: "Hogar", emoji: "🧹", color: "#02f2ca" },
  { name: "Servicios", emoji: "💡", color: "#eab308" },
  { name: "Transporte", emoji: "🚕", color: "#3b82f6" },
  { name: "Combustible", emoji: "⛽", color: "#ff0000" },
  { name: "Vehiculo", emoji: "🚗", color: "#94a3b8" },
  { name: "Salidas", emoji: "🍻", color: "#a855f7" },
  { name: "Salud", emoji: "💊", color: "#ef4444" },
  { name: "Cuidado personal", emoji: "💈", color: "#14b8a6" },
  { name: "Suscripciones", emoji: "📺", color: "#06b6d4" },
  { name: "Juegos", emoji: "🎮", color: "#6366f1" },
  { name: "Compras", emoji: "🛍️", color: "#d946ef" },
  { name: "Mascotas", emoji: "🐱", color: "#f59e0b" },
  { name: "Pareja", emoji: "💕", color: "#ec4899" },
  { name: "Efectivo", emoji: "🏧", color: "#84cc16" },
  { name: "Sueldo", emoji: "💼", color: "#10b981" },
  { name: "Préstamos", emoji: "🤝", color: "#64748b" },
  { name: "Otros", emoji: "💸", color: "#737373" },
]

async function main() {
  await db.insert(categories).values(defaults).onConflictDoNothing()
  console.log(`Categorías cargadas (${defaults.length})`)
}

main()
