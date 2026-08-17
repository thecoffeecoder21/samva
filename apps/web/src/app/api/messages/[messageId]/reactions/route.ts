import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb, messages, reactions } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ messageId: string }> };

const bodySchema = z.object({ emoji: z.string().min(1).max(8) });

export async function POST(request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { emoji } = parsed.data;

  const db = getDb();
  const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.query.conversationMembers.findFirst({
    where: and(
      eq(conversationMembers.conversationId, message.conversationId),
      eq(conversationMembers.userId, user.id),
    ),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await db.query.reactions.findFirst({
    where: and(eq(reactions.messageId, messageId), eq(reactions.userId, user.id), eq(reactions.emoji, emoji)),
  });

  if (existing) {
    await db
      .delete(reactions)
      .where(and(eq(reactions.messageId, messageId), eq(reactions.userId, user.id), eq(reactions.emoji, emoji)));
  } else {
    await db.insert(reactions).values({ messageId, userId: user.id, emoji });
  }

  const current = await db.select().from(reactions).where(eq(reactions.messageId, messageId));
  const dto = current.map((r) => ({ emoji: r.emoji, userId: r.userId }));

  await publishEvent(message.conversationId, {
    type: "message.reaction",
    payload: { messageId, conversationId: message.conversationId, reactions: dto },
  });

  return NextResponse.json({ reactions: dto });
}
