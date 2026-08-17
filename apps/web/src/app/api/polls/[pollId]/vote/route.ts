import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb, messages, pollOptions, pollVotes, polls } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { hydratePolls } from "@/lib/messages";
import { publishEvent } from "@/lib/realtime/bus";

type RouteContext = { params: Promise<{ pollId: string }> };

const voteSchema = z.object({ optionId: z.string().uuid() });

export async function POST(request: Request, context: RouteContext) {
  const { pollId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = voteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { optionId } = parsed.data;

  const db = getDb();
  const pollRow = await db.query.polls.findFirst({ where: eq(polls.id, pollId) });
  if (!pollRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const option = await db.query.pollOptions.findFirst({
    where: and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)),
  });
  if (!option) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.query.messages.findFirst({ where: eq(messages.id, pollRow.messageId) });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, message.conversationId), eq(conversationMembers.userId, user.id)),
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingVote = await db.query.pollVotes.findFirst({
    where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.optionId, optionId), eq(pollVotes.userId, user.id)),
  });

  if (existingVote) {
    await db
      .delete(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.optionId, optionId), eq(pollVotes.userId, user.id)));
  } else {
    if (!pollRow.allowMultiple) {
      await db.delete(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, user.id)));
    }
    await db.insert(pollVotes).values({ pollId, optionId, userId: user.id });
  }

  const poll = (await hydratePolls([pollRow], user.id)).get(pollRow.messageId);
  if (!poll) return NextResponse.json({ error: "Failed to load poll" }, { status: 500 });

  await publishEvent(message.conversationId, {
    type: "poll.voted",
    payload: { conversationId: message.conversationId, messageId: pollRow.messageId, poll },
  });

  return NextResponse.json({ poll });
}
