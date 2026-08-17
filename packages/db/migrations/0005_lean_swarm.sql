ALTER TABLE "conversations" ADD COLUMN "disappearing_seconds" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "messages_expires_at_idx" ON "messages" USING btree ("expires_at");