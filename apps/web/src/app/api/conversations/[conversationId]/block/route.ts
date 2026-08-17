import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { blocks, conversationMembers, conversations, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function getDirectPeerId(conversationId: string, userId: string) {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation || conversation.type !== "direct") return null;

  const peer = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.userId, userId)),
  });
  return peer?.userId ?? null;
}

export async function POST(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const peerId = await getDirectPeerId(conversationId, user.id);
  if (!peerId) return NextResponse.json({ error: "Can only block in a direct conversation" }, { status: 400 });

  const db = getDb();
  await db.insert(blocks).values({ blockerId: user.id, blockedId: peerId }).onConflictDoNothing();

  await publishEvent(conversationId, {
    type: "conversation.blocked",
    payload: { conversationId, blockedUserId: peerId, blocked: true },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const peerId = await getDirectPeerId(conversationId, user.id);
  if (!peerId) return NextResponse.json({ error: "Can only unblock in a direct conversation" }, { status: 400 });

  const db = getDb();
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, peerId)));

  await publishEvent(conversationId, {
    type: "conversation.blocked",
    payload: { conversationId, blockedUserId: peerId, blocked: false },
  });
  return NextResponse.json({ ok: true });
}
