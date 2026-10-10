import { NextResponse } from "next/server";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { toMessageDto } from "@/lib/messages";
import { publishEvent } from "@/lib/realtime/bus";
import { isBlocked } from "@/lib/blocks";

type RouteContext = { params: Promise<{ conversationId: string; messageId: string }> };

async function requireMembership(conversationId: string, userId: string) {
  const db = getDb();
  return (
    (await db.query.conversationMembers.findFirst({
      where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
    })) ?? null
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { conversationId, messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMembership(conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  // A thread is only ever rooted at a top-level message — replying inside a
  // thread flattens to the same root, so threadRootId being set here would
  // mean the caller passed a reply's id by mistake.
  const root = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId), isNull(messages.threadRootId)),
  });
  if (!root) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const replyRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadRootId, messageId))
    .orderBy(asc(messages.sequence));

  return NextResponse.json({
    root: toMessageDto(root, [], []),
    replies: replyRows.map((row) => toMessageDto(row, [], [])),
  });
}

const bodySchema = z.object({
  content: z.string().min(1).max(8000),
  clientId: z.string().min(1).max(64),
});

export async function POST(request: Request, context: RouteContext) {
  const { conversationId, messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await requireMembership(conversationId, user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const conversationRow = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (conversationRow?.type === "channel" && membership.role === "member") {
    return NextResponse.json({ error: "Only channel owners and admins can post here" }, { status: 403 });
  }
  if (conversationRow?.type === "direct") {
    const peer = await db.query.conversationMembers.findFirst({
      where: and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.userId, user.id)),
    });
    if (peer && (await isBlocked(user.id, peer.userId))) {
      return NextResponse.json({ error: "You can't send messages in this conversation" }, { status: 403 });
    }
  }

  const root = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId), isNull(messages.threadRootId)),
  });
  if (!root) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await db.query.messages.findFirst({
    where: and(eq(messages.conversationId, conversationId), eq(messages.senderId, user.id), eq(messages.clientId, parsed.data.clientId)),
  });
  if (existing) {
    return NextResponse.json({ message: toMessageDto(existing, [], []) });
  }

  const now = new Date();
  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: user.id,
      type: "text",
      content: parsed.data.content,
      threadRootId: messageId,
      clientId: parsed.data.clientId,
    })
    .returning();
  if (!row) return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });

  const [updatedRoot] = await db
    .update(messages)
    .set({ threadReplyCount: root.threadReplyCount + 1, lastThreadReplyAt: now })
    .where(eq(messages.id, messageId))
    .returning();

  const dto = toMessageDto(row, [], []);
  await publishEvent(conversationId, {
    type: "message.thread_reply",
    payload: {
      conversationId,
      rootMessageId: messageId,
      message: dto,
      threadReplyCount: updatedRoot?.threadReplyCount ?? root.threadReplyCount + 1,
      lastThreadReplyAt: now.toISOString(),
    },
  });

  return NextResponse.json({ message: dto }, { status: 201 });
}
