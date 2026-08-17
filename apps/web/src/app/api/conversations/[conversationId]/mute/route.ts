import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

// "always" is stored as a far-future timestamp rather than a separate
// boolean column — mutedUntil's existing `> now` comparison (used by both
// the conversation list and notifyOtherMembers) already treats it as muted
// indefinitely with no extra branching needed elsewhere.
const FAR_FUTURE = new Date("9999-12-31T00:00:00Z");

const bodySchema = z.object({ duration: z.enum(["1h", "8h", "always", "off"]) });

export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const mutedUntil =
    parsed.data.duration === "off"
      ? null
      : parsed.data.duration === "always"
        ? FAR_FUTURE
        : new Date(Date.now() + (parsed.data.duration === "1h" ? 3600_000 : 8 * 3600_000));

  const db = getDb();
  const result = await db
    .update(conversationMembers)
    .set({ mutedUntil })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)))
    .returning({ conversationId: conversationMembers.conversationId });

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mutedUntilIso = mutedUntil?.toISOString() ?? null;
  await publishEvent(conversationId, {
    type: "conversation.muted_updated",
    payload: { conversationId, userId: user.id, mutedUntil: mutedUntilIso },
  });

  return NextResponse.json({ ok: true, mutedUntil: mutedUntilIso });
}
