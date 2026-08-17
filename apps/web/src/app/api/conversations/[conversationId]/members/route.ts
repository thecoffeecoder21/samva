import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb, profiles } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { getConversationMembers } from "@/lib/queries";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ conversationId: string }> };

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export async function GET(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await getConversationMembers(conversationId);
  return NextResponse.json({ members });
}

const bodySchema = z.object({ usernames: z.array(z.string().min(1).max(20)).min(1).max(100) });

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "member") {
    return NextResponse.json({ error: "Only owners and admins can add members" }, { status: 403 });
  }

  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation || conversation.type === "direct") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const usernames = [...new Set(parsed.data.usernames.map(normalizeUsername))];
  const foundProfiles = await db.query.profiles.findMany({ where: inArray(profiles.username, usernames) });
  const foundUsernames = new Set(foundProfiles.map((p) => p.username));
  const missing = usernames.filter((u) => !foundUsernames.has(u));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `No user found with username${missing.length > 1 ? "s" : ""}: ${missing.map((u) => `@${u}`).join(", ")}` },
      { status: 404 },
    );
  }

  const existingMembers = await db.query.conversationMembers.findMany({
    where: eq(conversationMembers.conversationId, conversationId),
  });
  const existingIds = new Set(existingMembers.map((m) => m.userId));
  const toAdd = foundProfiles.filter((p) => !existingIds.has(p.userId));
  if (toAdd.length === 0) return NextResponse.json({ ok: true, added: [] });

  await db.insert(conversationMembers).values(toAdd.map((p) => ({ conversationId, userId: p.userId, role: "member" as const })));

  for (const p of toAdd) {
    await publishEvent(conversationId, {
      type: "conversation.member_added",
      payload: {
        conversationId,
        member: { userId: p.userId, username: p.username, displayName: p.displayName, avatarUrl: p.avatarUrl, role: "member" },
      },
    });
  }

  return NextResponse.json({ ok: true, added: toAdd.map((p) => p.username) });
}
