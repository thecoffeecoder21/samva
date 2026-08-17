import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

const bodySchema = z.object({
  messageId: z.string().uuid(),
  sequence: z.string(),
});

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const { messageId, sequence } = parsed.data;

  const result = await db
    .update(conversationMembers)
    .set({ lastReadMessageId: messageId, lastReadSequence: BigInt(sequence) })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)))
    .returning({ conversationId: conversationMembers.conversationId });

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await publishEvent(conversationId, {
    type: "read.receipt",
    payload: { conversationId, userId: user.id, messageId },
  });

  return NextResponse.json({ ok: true });
}
