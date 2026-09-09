CREATE TYPE "public"."jurisdiction" AS ENUM('eu_de', 'cn', 'kr', 'in');--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('staff', 'site_admin');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('view', 'create', 'update', 'delete', 'export', 'send', 'login', 'login_failed', 'logout', 'permission_change', 'cross_site_view', 'admin_console_enter');--> statement-breakpoint
CREATE TABLE "site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country" text NOT NULL,
	"jurisdiction" "jurisdiction" NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "site_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login_id" text NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"password_hash" text,
	"password_changed_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
CREATE TABLE "user_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"role_snapshot" "site_role" NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_site_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"role" "site_role" DEFAULT 'staff' NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"category" text,
	"address" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"email_normalized" text,
	"phone" text,
	"position" text,
	"department" text,
	"category" text,
	"language" text,
	"country" text,
	"consent_status" text DEFAULT 'unknown' NOT NULL,
	"consent_expires_at" timestamp with time zone,
	"last_contacted_at" timestamp with time zone,
	"owner_user_id" uuid,
	"source" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_site_id" uuid NOT NULL,
	"target_site_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"detail" jsonb,
	"ip_address" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"value_encrypted" "bytea",
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_site_membership" ADD CONSTRAINT "user_site_membership_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_site_membership" ADD CONSTRAINT "user_site_membership_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_site_membership" ADD CONSTRAINT "user_site_membership_granted_by_app_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_site_id_site_id_fk" FOREIGN KEY ("actor_site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_target_site_id_site_id_fk" FOREIGN KEY ("target_site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_user" ON "user_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_membership_active" ON "user_site_membership" USING btree ("user_id","site_id") WHERE "user_site_membership"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "idx_company_site" ON "company" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_contact_site" ON "contact" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contact_site_email" ON "contact" USING btree ("site_id","email_normalized");--> statement-breakpoint
CREATE INDEX "idx_audit_target_site" ON "audit_log" USING btree ("target_site_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor_site" ON "audit_log" USING btree ("actor_site_id","occurred_at");