import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb, messageReports, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { toMessageDto } from "@/lib/messages";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string; messageId: string }> };

const bodySchema = z.object({ action: z.enum(["remove", "dismiss"]) });

export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId, messageId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await db
    .update(messageReports)
    .set({ status: parsed.data.action === "remove" ? "resolved" : "dismissed", resolvedAt: new Date(), resolvedBy: user.id })
    .where(and(eq(messageReports.conversationId, conversationId), eq(messageReports.messageId, messageId), eq(messageReports.status, "open")));

  if (parsed.data.action === "remove") {
    const [row] = await db
      .update(messages)
      .set({ deletedAt: new Date(), content: null, updatedAt: new Date() })
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .returning();
    if (row) {
      const dto = toMessageDto(row, [], []);
      await publishEvent(conversationId, { type: "message.deleted", payload: { id: dto.id, conversationId } });
    }
  }

  return NextResponse.json({ ok: true });
}
