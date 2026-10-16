import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const txTypeEnum = pgEnum("tx_type", [
  "expense",
  "income",
  "transfer_out",
  "transfer_in",
  "internal", // entre cuentas propias: no es ingreso ni gasto
])

export const txSourceEnum = pgEnum("tx_source", [
  "apple_pay",
  "mercadopago",
  "lemon",
  "galicia",
  "manual",
  "other",
])

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  emoji: text("emoji").notNull().default("💸"),
  color: text("color").notNull().default("#737373"),
})

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: txTypeEnum("type").notNull().default("expense"),
    source: txSourceEnum("source").notNull().default("manual"),
    merchant: text("merchant"),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    needsReview: boolean("needs_review").notNull().default(false),
  },
  (t) => [index("transactions_occurred_at_idx").on(t.occurredAt)]
)

export const merchantRules = pgTable("merchant_rules", {
  id: serial("id").primaryKey(),
  pattern: text("pattern").notNull().unique(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
})

/**
 * Gastos que se repiten todos los meses (alquiler, luz, internet…).
 * Se consideran pagados en un mes si hay un egreso de esa categoría
 * cuyo comercio/nota contenga `pattern` (o cualquiera, si no hay pattern).
 */
export const fixedBills = pgTable("fixed_bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  pattern: text("pattern"),
  expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }),
  dueDay: integer("due_day"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Saldo inicial cargado a mano y estado de cierre de cada mes ("YYYY-MM"). */
export const monthBalances = pgTable("month_balances", {
  month: text("month").primaryKey(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
})

/** Sobres de ahorro: plata apartada que ya no cuenta como disponible. */
export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  emoji: text("emoji").notNull().default("💰"),
  color: text("color").notNull().default("#10b981"),
  target: numeric("target", { precision: 14, scale: 2 }),
  isUsd: boolean("is_usd").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Depósitos (+) y retiros (−) de un sobre, en pesos. `month` es el mes cuyo
 * disponible afecta. En el sobre de dólares, `usd` guarda los dólares comprados.
 */
export const savingsMovements = pgTable("savings_movements", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id")
    .notNull()
    .references(() => savingsGoals.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  usd: numeric("usd", { precision: 14, scale: 2 }),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Category = typeof categories.$inferSelect
export type SavingsGoal = typeof savingsGoals.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type TxType = (typeof txTypeEnum.enumValues)[number]
export type TxSource = (typeof txSourceEnum.enumValues)[number]
