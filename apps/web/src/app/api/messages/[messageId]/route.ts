import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { toMessageDto } from "@/lib/messages";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ messageId: string }> };

const patchSchema = z.object({ content: z.string().min(1).max(8000) });

export async function PATCH(request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .update(messages)
    .set({ content: parsed.data.content, editedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.senderId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dto = toMessageDto(row, [], []);
  await publishEvent(row.conversationId, { type: "message.updated", payload: dto });
  return NextResponse.json({ message: dto });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [row] = await db
    .update(messages)
    .set({ deletedAt: new Date(), content: null, updatedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.senderId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await publishEvent(row.conversationId, {
    type: "message.deleted",
    payload: { id: row.id, conversationId: row.conversationId },
  });
  return NextResponse.json({ ok: true });
}
