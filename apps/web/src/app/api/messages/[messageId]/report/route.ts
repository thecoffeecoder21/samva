import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb, messageReports, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ messageId: string }> };

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  // Reporting is scoped to channels — direct/group members can already block
  // or remove each other, but a channel's followers have no other recourse
  // against a broadcasting owner/admin's post.
  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, message.conversationId) });
  if (!conversation || conversation.type !== "channel") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, message.conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .insert(messageReports)
    .values({
      messageId,
      conversationId: message.conversationId,
      reporterId: user.id,
      reason: parsed.data.reason,
    })
    .onConflictDoNothing();

  await publishEvent(message.conversationId, {
    type: "message.reported",
    payload: { conversationId: message.conversationId, messageId },
  });

  return NextResponse.json({ ok: true });
}
