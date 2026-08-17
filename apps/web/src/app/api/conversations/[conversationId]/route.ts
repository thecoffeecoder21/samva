import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "member") {
    return NextResponse.json({ error: "Only owners and admins can edit this conversation" }, { status: 403 });
  }

  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation || conversation.type === "direct") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { name, description, avatarUrl, isPublic } = parsed.data;
  if (isPublic !== undefined && conversation.type !== "channel") {
    return NextResponse.json({ error: "Only channels can be made public" }, { status: 400 });
  }

  const [updated] = await db
    .update(conversations)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
    })
    .where(eq(conversations.id, conversationId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  await publishEvent(conversationId, {
    type: "conversation.updated",
    payload: {
      conversationId,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      description: updated.description,
      isPublic: updated.isPublic,
    },
  });

  return NextResponse.json({
    name: updated.name,
    avatarUrl: updated.avatarUrl,
    description: updated.description,
    isPublic: updated.isPublic,
  });
}
