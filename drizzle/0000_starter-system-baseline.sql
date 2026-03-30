CREATE TYPE "public"."user_role" AS ENUM('admin', 'user', 'unverified');--> statement-breakpoint
CREATE TABLE "system_auth_login_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"redirect_uri" text,
	"post_login_redirect" text,
	"post_logout_redirect" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"tenant_id" text NOT NULL,
	"aad_object_id" text NOT NULL,
	"user_id" text NOT NULL,
	"claims_json" jsonb NOT NULL,
	"refresh_token_ciphertext" text,
	"refresh_token_iv" text,
	"refresh_token_tag" text,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"max_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"aad_object_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"role" "user_role" DEFAULT 'unverified' NOT NULL,
	"is_authorized" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "system_auth_login_states_state_hash_unique" ON "system_auth_login_states" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "system_auth_sessions_session_hash_unique" ON "system_auth_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "system_users_tenant_oid_unique" ON "system_users" USING btree ("tenant_id","aad_object_id");