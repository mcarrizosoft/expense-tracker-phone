ALTER TYPE "public"."tx_type" ADD VALUE 'internal';--> statement-breakpoint
CREATE TABLE "month_balances" (
	"month" text PRIMARY KEY NOT NULL,
	"opening_balance" numeric(14, 2),
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '💰' NOT NULL,
	"color" text DEFAULT '#10b981' NOT NULL,
	"target" numeric(14, 2),
	"is_usd" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_goals_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "savings_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"month" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"usd" numeric(14, 2),
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "savings_movements" ADD CONSTRAINT "savings_movements_goal_id_savings_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."savings_goals"("id") ON DELETE cascade ON UPDATE no action;