CREATE TYPE "public"."import_status" AS ENUM('processing', 'completed', 'failed', 'reverted');--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"column_mapping" jsonb,
	"row_count_total" integer DEFAULT 0 NOT NULL,
	"row_count_created" integer DEFAULT 0 NOT NULL,
	"row_count_duplicate" integer DEFAULT 0 NOT NULL,
	"row_count_error" integer DEFAULT 0 NOT NULL,
	"error_detail" jsonb,
	"status" "import_status" DEFAULT 'processing' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_uploaded_by_app_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;