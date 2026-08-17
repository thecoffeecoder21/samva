import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string; userId: string }> };

const roleBodySchema = z.object({ role: z.enum(["admin", "member"]) });

export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId, userId: targetUserId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change member roles" }, { status: 403 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  }

  const target = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, targetUserId)),
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner's role can't be changed" }, { status: 400 });
  }

  const parsed = roleBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await db
    .update(conversationMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, targetUserId)));

  await publishEvent(conversationId, {
    type: "conversation.member_role_changed",
    payload: { conversationId, userId: targetUserId, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { conversationId, userId: targetUserId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "member") {
    return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You can't remove yourself here" }, { status: 400 });
  }

  const target = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, targetUserId)),
  });
  if (!target) return NextResponse.json({ ok: true });
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner can't be removed" }, { status: 400 });
  }
  if (target.role === "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can remove an admin" }, { status: 403 });
  }

  await db
    .delete(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, targetUserId)));

  await publishEvent(conversationId, {
    type: "conversation.member_removed",
    payload: { conversationId, userId: targetUserId },
  });

  return NextResponse.json({ ok: true });
}
