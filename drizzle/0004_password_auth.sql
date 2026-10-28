CREATE TABLE "auth_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_challenges_email_idx" ON "auth_challenges" USING btree ("email","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_devices_user_token_idx" ON "trusted_devices" USING btree ("user_id","token_hash");--> statement-breakpoint
CREATE INDEX "trusted_devices_user_idx" ON "trusted_devices" USING btree ("user_id");