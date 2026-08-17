import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function requireMembership(conversationId: string, userId: string) {
  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
  });
  return membership ?? null;
}

const bodySchema = z.object({ messageId: z.string().uuid() });

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMembership(conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, parsed.data.messageId), eq(messages.conversationId, conversationId)),
  });
  if (!message) return NextResponse.json({ error: "Message not found in this conversation" }, { status: 404 });

  await db
    .update(conversations)
    .set({ pinnedMessageId: message.id })
    .where(eq(conversations.id, conversationId));

  await publishEvent(conversationId, { type: "conversation.pinned", payload: { conversationId, messageId: message.id } });
  return NextResponse.json({ ok: true, messageId: message.id });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireMembership(conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  await db.update(conversations).set({ pinnedMessageId: null }).where(eq(conversations.id, conversationId));

  await publishEvent(conversationId, { type: "conversation.pinned", payload: { conversationId, messageId: null } });
  return NextResponse.json({ ok: true });
}
