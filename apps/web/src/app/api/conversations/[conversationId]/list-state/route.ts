import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

const bodySchema = z.object({ pinned: z.boolean().optional(), archived: z.boolean().optional() });

// Per-user chat-list organization (pin/archive) — distinct from the shared
// pinned *message* feature at /api/conversations/[id]/pin, which is a
// conversation-wide banner every member sees.
export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: { pinnedAt?: Date | null; archivedAt?: Date | null } = {};
  if (parsed.data.pinned !== undefined) patch.pinnedAt = parsed.data.pinned ? new Date() : null;
  if (parsed.data.archived !== undefined) patch.archivedAt = parsed.data.archived ? new Date() : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .update(conversationMembers)
    .set(patch)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPinned = Boolean(row.pinnedAt);
  const isArchived = Boolean(row.archivedAt);
  await publishEvent(conversationId, {
    type: "conversation.list_state_updated",
    payload: { conversationId, userId: user.id, isPinned, isArchived },
  });

  return NextResponse.json({ ok: true, isPinned, isArchived });
}
