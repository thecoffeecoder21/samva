ALTER TABLE "conversations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;