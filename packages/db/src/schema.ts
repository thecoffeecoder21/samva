import {
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").notNull().unique(), // Clerk user id
  phone: text("phone").unique(),
  email: text("email").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    statusEmoji: text("status_emoji"),
    statusText: text("status_text"),
    isProfessional: boolean("is_professional").default(false).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("profiles_username_idx").on(t.username)],
);

/** 'direct' = 1:1, 'group' = private group, 'channel' = broadcast (section 42). */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type", { enum: ["direct", "group", "channel"] }).notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  // Group/channel bio shown in the info dialog and (for channels) the
  // Discover/Communities directory listing. Unused for direct conversations.
  description: text("description"),
  // Channels only: true makes the channel discoverable/joinable from the
  // Discover directory. Groups stay invite-only regardless of this flag.
  isPublic: boolean("is_public").default(false).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  // Deliberately not a DB-level FK to messages — that table references
  // conversations already, and Postgres can't have both sides of a
  // straightforward two-table circular FK without deferred constraints.
  // Validated at the application layer instead (see /api/conversations/[id]/pin).
  pinnedMessageId: uuid("pinned_message_id"),
  // Seconds after send that a new message in this conversation expires, or
  // null when disappearing messages are off. Presets enforced at the API
  // layer (off / 1h / 1d / 1w), matching the common WhatsApp-style options.
  disappearingSeconds: integer("disappearing_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .default("member")
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadSequence: bigserial("last_read_sequence", { mode: "bigint" }),
    // Per-user chat-list organization — deliberately columns on the
    // membership row (not a global conversation flag) since pinning/archiving
    // is something each member decides for their own list, not something
    // that should be visible to or affect other members.
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_members_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Monotonic per-row sequence backing cursor pagination (section 40: no offset pagination).
    sequence: bigserial("sequence", { mode: "bigint" }).notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    type: text("type", {
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "voice",
        "document",
        "contact",
        "location",
        "poll",
        "link",
        "system",
        "call_event",
      ],
    }).notNull(),
    content: text("content"),
    replyToId: uuid("reply_to_id"),
    // Thread reply pointer, flattened to the top-level message id (never
    // chained) — replying inside an already-open thread always points back
    // at the same root, so a thread is always exactly two levels deep. Not a
    // DB-level self-FK, consistent with replyToId above.
    threadRootId: uuid("thread_root_id"),
    threadReplyCount: integer("thread_reply_count").default(0).notNull(),
    lastThreadReplyAt: timestamp("last_thread_reply_at", { withTimezone: true }),
    // Client-generated idempotency key so retried sends never duplicate (section 108).
    clientId: text("client_id"),
    // Opt-in full-screen send effect (iMessage-style) — set by the sender at
    // compose time, played once by every client when the message arrives.
    effect: text("effect", { enum: ["confetti", "balloons", "hearts", "fireworks"] }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Set at send time from the conversation's disappearingSeconds at that
    // moment; null means this message never expires. The cron-purged /
    // query-filtered pattern is documented on generateAndAttachLinkPreview's
    // neighbor, purgeExpiredMessages, in lib/messages.ts.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_conversation_sequence_idx").on(t.conversationId, t.sequence),
    uniqueIndex("messages_conversation_client_idx").on(t.conversationId, t.senderId, t.clientId),
    index("messages_expires_at_idx").on(t.expiresAt),
    index("messages_thread_root_idx").on(t.threadRootId),
  ],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    fileName: text("file_name"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
  },
  (t) => [index("message_attachments_message_idx").on(t.messageId)],
);

export const reactions = pgTable(
  "reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("blocks_blocker_blocked_idx").on(t.blockerId, t.blockedId),
    index("blocks_blocker_idx").on(t.blockerId),
  ],
);

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .unique()
    .references(() => messages.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  allowMultiple: boolean("allow_multiple").default(false).notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("poll_options_poll_idx").on(t.pollId)],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pollId, t.optionId, t.userId] }),
    index("poll_votes_poll_idx").on(t.pollId),
  ],
);

export const conversationFolders = pgTable(
  "conversation_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("conversation_folders_user_idx").on(t.userId)],
);

export const conversationFolderMembers = pgTable(
  "conversation_folder_members",
  {
    folderId: uuid("folder_id")
      .notNull()
      .references(() => conversationFolders.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.folderId, t.conversationId] })],
);

// Channel moderation: any follower can flag a message; owners/admins review
// and either dismiss or remove it (soft-delete via messages.deletedAt).
// Unique per (message, reporter) so re-reporting the same message no-ops
// instead of piling up duplicate rows.
export const messageReports = pgTable(
  "message_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["open", "resolved", "dismissed"] })
      .default("open")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("message_reports_message_reporter_idx").on(t.messageId, t.reporterId),
    index("message_reports_conversation_idx").on(t.conversationId),
  ],
);

export const linkPreviews = pgTable("link_previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .unique()
    .references(() => messages.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  memberships: many(conversationMembers),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  attachments: many(messageAttachments),
  reactions: many(reactions),
}));
