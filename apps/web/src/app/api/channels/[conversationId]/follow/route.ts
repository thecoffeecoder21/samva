import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { conversationMembers, conversations, getDb, profiles } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation || conversation.type !== "channel" || !conversation.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (existing) return NextResponse.json({ ok: true });

  await db.insert(conversationMembers).values({ conversationId, userId: user.id, role: "member" });

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
  await publishEvent(conversationId, {
    type: "conversation.member_added",
    payload: {
      conversationId,
      member: {
        userId: user.id,
        username: profile?.username ?? "",
        displayName: profile?.displayName ?? "Someone",
        avatarUrl: profile?.avatarUrl ?? null,
        role: "member",
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ ok: true });
  if (membership.role === "owner") {
    return NextResponse.json({ error: "The owner can't unfollow their own channel" }, { status: 400 });
  }

  await db
    .delete(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));

  await publishEvent(conversationId, {
    type: "conversation.member_removed",
    payload: { conversationId, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
