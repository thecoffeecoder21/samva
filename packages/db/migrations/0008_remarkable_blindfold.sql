CREATE TABLE "conversation_folder_members" (
	"folder_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_folder_members_folder_id_conversation_id_pk" PRIMARY KEY("folder_id","conversation_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "thread_root_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "thread_reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "last_thread_reply_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_folder_members" ADD CONSTRAINT "conversation_folder_members_folder_id_conversation_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."conversation_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_folder_members" ADD CONSTRAINT "conversation_folder_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_folders_user_idx" ON "conversation_folders" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reports_message_reporter_idx" ON "message_reports" USING btree ("message_id","reporter_id");--> statement-breakpoint
CREATE INDEX "message_reports_conversation_idx" ON "message_reports" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_thread_root_idx" ON "messages" USING btree ("thread_root_id");