CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"kind" text NOT NULL,
	"date" text NOT NULL,
	"buy" numeric(14, 2) NOT NULL,
	"sell" numeric(14, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_kind_date_pk" PRIMARY KEY("kind","date")
);
