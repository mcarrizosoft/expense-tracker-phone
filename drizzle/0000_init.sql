CREATE TYPE "public"."tx_source" AS ENUM('apple_pay', 'mercadopago', 'lemon', 'galicia', 'manual', 'other');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('expense', 'income', 'transfer_out', 'transfer_in');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '💸' NOT NULL,
	"color" text DEFAULT '#737373' NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "merchant_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern" text NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "merchant_rules_pattern_unique" UNIQUE("pattern")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "tx_type" DEFAULT 'expense' NOT NULL,
	"source" "tx_source" DEFAULT 'manual' NOT NULL,
	"merchant" text,
	"description" text DEFAULT '' NOT NULL,
	"category_id" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_occurred_at_idx" ON "transactions" USING btree ("occurred_at");