import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

// Presets only (WhatsApp-style): off, 1 hour, 1 day, 1 week — no free-form
// durations, to keep the option list simple.
const bodySchema = z.object({ seconds: z.union([z.literal(3600), z.literal(86400), z.literal(604800), z.null()]) });

export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { seconds } = parsed.data;
  await db.update(conversations).set({ disappearingSeconds: seconds }).where(eq(conversations.id, conversationId));

  await publishEvent(conversationId, {
    type: "conversation.disappearing_updated",
    payload: { conversationId, disappearingSeconds: seconds },
  });
  return NextResponse.json({ ok: true, disappearingSeconds: seconds });
}
