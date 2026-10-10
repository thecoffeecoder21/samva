import { NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";
import { conversationMembers, getDb, messages } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

type RouteContext = { params: Promise<{ conversationId: string }> };

const DAYS = 30;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const [allMembers, recentMembers, recentMessages] = await Promise.all([
    db.select({ joinedAt: conversationMembers.joinedAt }).from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId)),
    db
      .select({ joinedAt: conversationMembers.joinedAt })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), gte(conversationMembers.joinedAt, since))),
    db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), gte(messages.createdAt, since), isNull(messages.threadRootId))),
  ]);

  const totalFollowers = allMembers.length;
  const followersBeforeWindow = totalFollowers - recentMembers.length;

  // Build a dense daily series (no gaps) so the chart doesn't have to
  // special-case missing days — each day's count defaults to zero.
  const newFollowersByDay = new Map<string, number>();
  const messagesByDay = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const key = dayKey(new Date(since.getTime() + i * 86400_000));
    newFollowersByDay.set(key, 0);
    messagesByDay.set(key, 0);
  }
  for (const m of recentMembers) {
    const key = dayKey(m.joinedAt);
    newFollowersByDay.set(key, (newFollowersByDay.get(key) ?? 0) + 1);
  }
  for (const m of recentMessages) {
    const key = dayKey(m.createdAt);
    messagesByDay.set(key, (messagesByDay.get(key) ?? 0) + 1);
  }

  let cumulative = followersBeforeWindow;
  const followerGrowth = [...newFollowersByDay.entries()].map(([date, newFollowers]) => {
    cumulative += newFollowers;
    return { date, newFollowers, cumulativeFollowers: cumulative };
  });
  const messageActivity = [...messagesByDay.entries()].map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    totalFollowers,
    newFollowersLast30Days: recentMembers.length,
    messagesLast30Days: recentMessages.length,
    followerGrowth,
    messageActivity,
  });
}
