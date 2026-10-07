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

export type Category = typeof categories.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type TxType = (typeof txTypeEnum.enumValues)[number]
export type TxSource = (typeof txSourceEnum.enumValues)[number]
