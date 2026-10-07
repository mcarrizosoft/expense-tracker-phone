import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("Falta DATABASE_URL en el entorno")

export const db = drizzle(neon(url), { schema })
