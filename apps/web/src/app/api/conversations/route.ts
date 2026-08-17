import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, getDb, profiles } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { getConversationSummaries } from "@/lib/queries";
import { isBlocked } from "@/lib/blocks";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await getConversationSummaries(user.id);
  return NextResponse.json({ conversations });
}

const directSchema = z.object({
  type: z.literal("direct").optional(),
  username: z.string().min(1).max(20),
});

const groupSchema = z.object({
  type: z.literal("group"),
  name: z.string().min(1).max(60),
  usernames: z.array(z.string().min(1).max(20)).min(1).max(100),
});

const bodySchema = z.union([groupSchema, directSchema]);

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (parsed.data.type === "group") {
    return createGroup(user.id, parsed.data.name, parsed.data.usernames);
  }
  return createDirect(user.id, parsed.data.username);
}

async function createDirect(userId: string, usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const db = getDb();

  const targetProfile = await db.query.profiles.findFirst({ where: eq(profiles.username, username) });
  if (!targetProfile) return NextResponse.json({ error: `No user found with username @${username}` }, { status: 404 });
  if (targetProfile.userId === userId) {
    return NextResponse.json({ error: "You can't start a conversation with yourself" }, { status: 400 });
  }
  if (await isBlocked(userId, targetProfile.userId)) {
    return NextResponse.json({ error: "You can't start a conversation with this user" }, { status: 403 });
  }

  const existing = await findExistingDirectConversation(db, userId, targetProfile.userId);
  if (existing) return NextResponse.json({ conversationId: existing });

  const [conversation] = await db.insert(conversations).values({ type: "direct", createdBy: userId }).returning();
  if (!conversation) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });

  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId, role: "owner" },
    { conversationId: conversation.id, userId: targetProfile.userId, role: "member" },
  ]);

  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}

async function createGroup(userId: string, name: string, usernamesInput: string[]) {
  const db = getDb();
  const usernames = [...new Set(usernamesInput.map(normalizeUsername))];

  const foundProfiles = await db.query.profiles.findMany({ where: inArray(profiles.username, usernames) });
  const foundUsernames = new Set(foundProfiles.map((p) => p.username));
  const missing = usernames.filter((u) => !foundUsernames.has(u));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `No user found with username${missing.length > 1 ? "s" : ""}: ${missing.map((u) => `@${u}`).join(", ")}` },
      { status: 404 },
    );
  }

  const memberIds = [...new Set(foundProfiles.map((p) => p.userId).filter((id) => id !== userId))];

  const [conversation] = await db
    .insert(conversations)
    .values({ type: "group", name, createdBy: userId })
    .returning();
  if (!conversation) return NextResponse.json({ error: "Failed to create group" }, { status: 500 });

  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId, role: "owner" },
    ...memberIds.map((id) => ({ conversationId: conversation.id, userId: id, role: "member" as const })),
  ]);

  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}

async function findExistingDirectConversation(db: ReturnType<typeof getDb>, userA: string, userB: string) {
  const aMemberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.userId, userA), eq(conversations.type, "direct")));

  if (aMemberships.length === 0) return null;
  const ids = aMemberships.map((m) => m.conversationId);

  const shared = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.userId, userB), inArray(conversationMembers.conversationId, ids)));

  return shared[0]?.conversationId ?? null;
}
