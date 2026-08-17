import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { MessageType } from "@samva/types";
import {
  conversationMembers,
  conversations,
  getDb,
  messageAttachments,
  messages,
  pollOptions,
  polls,
  profiles,
} from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { generateAndAttachLinkPreview, hydratePolls, listMessages, toMessageDto } from "@/lib/messages";
import { publishEvent } from "@/lib/realtime/bus";
import { notifyOtherMembers } from "@/lib/pushSend";
import { isBlocked } from "@/lib/blocks";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function requireMembership(conversationId: string, userId: string) {
  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
  });
  return membership ?? null;
}

export async function GET(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMembership(conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before") ?? undefined;
  const result = await listMessages(conversationId, { before }, user.id);
  return NextResponse.json(result);
}

const attachmentSchema = z.object({
  url: z.string().url(),
  mimeType: z.string().min(1).max(255),
  fileName: z.string().max(255).nullable().optional(),
  sizeBytes: z.number().int().positive().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationMs: z.number().int().positive().nullable().optional(),
});

const pollPayloadSchema = z.object({
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(120)).min(2).max(10),
  allowMultiple: z.boolean().default(false),
});

const sendMessageSchema = z
  .object({
    type: z
      .enum(["text", "image", "video", "audio", "voice", "document", "location", "link", "poll"])
      .default("text"),
    content: z.string().max(8000).nullable().optional(),
    replyToId: z.string().uuid().nullable().optional(),
    clientId: z.string().min(1).max(64),
    attachments: z.array(attachmentSchema).max(10).default([]),
    poll: pollPayloadSchema.nullable().optional(),
    effect: z.enum(["confetti", "balloons", "hearts", "fireworks"]).nullable().optional(),
  })
  .refine((data) => data.type !== "poll" || Boolean(data.poll), {
    message: "A poll message needs poll data",
  })
  .refine((data) => data.type === "poll" || Boolean(data.content?.trim()) || data.attachments.length > 0, {
    message: "A message needs text content or at least one attachment",
  });

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await requireMembership(conversationId, user.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
  }

  const conversationRow = await getDb().query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (conversationRow?.type === "channel" && membership.role === "member") {
    return NextResponse.json({ error: "Only channel owners and admins can post here" }, { status: 403 });
  }
  if (conversationRow?.type === "direct") {
    const peer = await getDb().query.conversationMembers.findFirst({
      where: and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.userId, user.id)),
    });
    if (peer && (await isBlocked(user.id, peer.userId))) {
      return NextResponse.json({ error: "You can't send messages in this conversation" }, { status: 403 });
    }
  }

  const db = getDb();
  const { type, content, replyToId, clientId, attachments, poll, effect } = parsed.data;

  // Idempotent send: a retried request with the same clientId returns the
  // original row instead of creating a duplicate (section 108).
  const existing = await db.query.messages.findFirst({
    where: and(
      eq(messages.conversationId, conversationId),
      eq(messages.senderId, user.id),
      eq(messages.clientId, clientId),
    ),
  });
  if (existing) {
    const existingAttachments = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, existing.id));
    let existingPoll = null;
    if (existing.type === "poll") {
      const pollRow = await db.query.polls.findFirst({ where: eq(polls.messageId, existing.id) });
      if (pollRow) existingPoll = (await hydratePolls([pollRow], user.id)).get(existing.id) ?? null;
    }
    return NextResponse.json({ message: toMessageDto(existing, existingAttachments, [], existingPoll) });
  }

  const expiresAt = conversationRow?.disappearingSeconds
    ? new Date(Date.now() + conversationRow.disappearingSeconds * 1000)
    : null;

  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: user.id,
      type,
      content: content ?? null,
      replyToId: replyToId ?? null,
      clientId,
      expiresAt,
      effect: effect ?? null,
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  const attachmentRows =
    attachments.length > 0
      ? await db
          .insert(messageAttachments)
          .values(attachments.map((a) => ({ messageId: row.id, ...a })))
          .returning()
      : [];

  let pollDto = null;
  if (type === "poll" && poll) {
    const [pollRow] = await db
      .insert(polls)
      .values({ messageId: row.id, question: poll.question, allowMultiple: poll.allowMultiple })
      .returning();
    if (pollRow) {
      await db
        .insert(pollOptions)
        .values(poll.options.map((text, position) => ({ pollId: pollRow.id, text, position })));
      pollDto = (await hydratePolls([pollRow], user.id)).get(row.id) ?? null;
    }
  }

  await db
    .update(conversations)
    .set({ lastMessageAt: row.createdAt })
    .where(eq(conversations.id, conversationId));

  const dto = toMessageDto(row, attachmentRows, [], pollDto);
  await publishEvent(conversationId, { type: "message.created", payload: dto });

  if (type === "text" && attachmentRows.length === 0) {
    waitUntil(generateAndAttachLinkPreview(row).catch(() => {}));
  }

  const [conversation, senderProfile] = await Promise.all([
    db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) }),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
  ]);
  const senderName = senderProfile?.displayName ?? "Someone";
  const title = conversation?.type === "direct" ? senderName : (conversation?.name ?? senderName);
  const notificationBody =
    conversation?.type === "direct"
      ? (content ?? previewForType(type))
      : `${senderName}: ${content ?? previewForType(type)}`;
  notifyOtherMembers(conversationId, user.id, title, notificationBody).catch(() => {});

  return NextResponse.json({ message: dto }, { status: 201 });
}

function previewForType(type: MessageType) {
  switch (type) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "voice":
      return "🎤 Voice message";
    case "audio":
      return "🎵 Audio";
    case "document":
      return "📎 Document";
    case "poll":
      return "📊 Poll";
    default:
      return "Sent a message";
  }
}
