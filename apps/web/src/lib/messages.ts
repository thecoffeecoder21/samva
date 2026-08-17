import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import {
  getDb,
  linkPreviews,
  messageAttachments,
  messages,
  pollOptions,
  pollVotes,
  polls,
  reactions,
  type messages as messagesTable,
  type polls as pollsTable,
} from "@samva/db";
import type { LinkPreview, Message, Poll, Reaction as ReactionDto } from "@samva/types";
import { extractFirstUrl, fetchLinkPreview } from "@/lib/linkPreview";
import { publishEvent } from "@/lib/realtime/bus";

const DEFAULT_PAGE_SIZE = 30;

type MessageRow = typeof messagesTable.$inferSelect;
type PollRow = typeof pollsTable.$inferSelect;

export async function listMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
  viewerId?: string,
) {
  const db = getDb();
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, 100);

  const notExpired = or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date()));
  const rows = await db
    .select()
    .from(messages)
    .where(
      opts.before
        ? and(eq(messages.conversationId, conversationId), lt(messages.sequence, BigInt(opts.before)), notExpired)
        : and(eq(messages.conversationId, conversationId), notExpired),
    )
    .orderBy(desc(messages.sequence))
    .limit(limit);

  const hydrated = await hydrate(rows, viewerId ?? "");
  // Return oldest-first for rendering; nextCursor points to the oldest row's
  // sequence so the next page request asks for "before" that.
  hydrated.reverse();
  const nextCursor = rows.length === limit ? rows[rows.length - 1]!.sequence.toString() : null;
  return { messages: hydrated, nextCursor };
}

async function hydrate(rows: MessageRow[], viewerId: string): Promise<Message[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);

  const [attachmentRows, reactionRows, pollRows, linkPreviewRows] = await Promise.all([
    db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, ids)),
    db.select().from(reactions).where(inArray(reactions.messageId, ids)),
    db.select().from(polls).where(inArray(polls.messageId, ids)),
    db.select().from(linkPreviews).where(inArray(linkPreviews.messageId, ids)),
  ]);

  const attachmentsByMessage = groupBy(attachmentRows, (r) => r.messageId);
  const reactionsByMessage = groupBy(reactionRows, (r) => r.messageId);
  const pollsByMessage = await hydratePolls(pollRows, viewerId);
  const linkPreviewsByMessage = new Map(linkPreviewRows.map((r) => [r.messageId, toLinkPreviewDto(r)]));

  return rows.map((row) =>
    toMessageDto(
      row,
      attachmentsByMessage.get(row.id) ?? [],
      reactionsByMessage.get(row.id) ?? [],
      pollsByMessage.get(row.id) ?? null,
      linkPreviewsByMessage.get(row.id) ?? null,
    ),
  );
}

export function toLinkPreviewDto(row: typeof linkPreviews.$inferSelect): LinkPreview {
  return {
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    siteName: row.siteName,
  };
}

export async function hydratePolls(pollRows: PollRow[], viewerId: string): Promise<Map<string, Poll>> {
  const result = new Map<string, Poll>();
  if (pollRows.length === 0) return result;
  const db = getDb();
  const pollIds = pollRows.map((p) => p.id);

  const [optionRows, voteRows] = await Promise.all([
    db.select().from(pollOptions).where(inArray(pollOptions.pollId, pollIds)),
    db.select().from(pollVotes).where(inArray(pollVotes.pollId, pollIds)),
  ]);

  const optionsByPoll = groupBy(optionRows, (r) => r.pollId);
  const votesByOption = groupBy(voteRows, (r) => r.optionId);

  for (const poll of pollRows) {
    const options = (optionsByPoll.get(poll.id) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((opt) => {
        const votes = votesByOption.get(opt.id) ?? [];
        return {
          id: opt.id,
          text: opt.text,
          position: opt.position,
          voteCount: votes.length,
          votedByMe: votes.some((v) => v.userId === viewerId),
        };
      });
    result.set(poll.messageId, {
      id: poll.id,
      question: poll.question,
      allowMultiple: poll.allowMultiple,
      closesAt: poll.closesAt?.toISOString() ?? null,
      totalVotes: options.reduce((sum, o) => sum + o.voteCount, 0),
      options,
    });
  }
  return result;
}

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function toMessageDto(
  row: MessageRow,
  attachments: (typeof messageAttachments.$inferSelect)[],
  reactionRows: (typeof reactions.$inferSelect)[],
  poll: Poll | null = null,
  linkPreview: LinkPreview | null = null,
): Message {
  const reactionDtos: ReactionDto[] = reactionRows.map((r) => ({ emoji: r.emoji, userId: r.userId }));
  return {
    id: row.id,
    sequence: row.sequence.toString(),
    conversationId: row.conversationId,
    senderId: row.senderId,
    type: row.type,
    content: row.content,
    poll,
    linkPreview,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    effect: row.effect,
    attachments: attachments.map((a) => ({
      id: a.id,
      url: a.url,
      mimeType: a.mimeType,
      fileName: a.fileName,
      sizeBytes: a.sizeBytes,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
    })),
    replyToId: row.replyToId,
    reactions: reactionDtos,
    status: "sent",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    clientId: row.clientId,
  };
}

// Fire-and-forget after a text message is sent (see the messages POST route,
// which schedules this via `waitUntil` so it can keep running after the
// response is flushed). Fetching and parsing the target page can take
// seconds, so the preview arrives a moment later via a `message.updated`
// realtime event rather than blocking the send.
export async function generateAndAttachLinkPreview(row: MessageRow) {
  const url = extractFirstUrl(row.content);
  if (!url) return;
  const preview = await fetchLinkPreview(url);
  if (!preview) return;

  const db = getDb();
  const [inserted] = await db
    .insert(linkPreviews)
    .values({ messageId: row.id, url, ...preview })
    .onConflictDoNothing()
    .returning();
  if (!inserted) return;

  const [attachmentRows, reactionRows] = await Promise.all([
    db.select().from(messageAttachments).where(eq(messageAttachments.messageId, row.id)),
    db.select().from(reactions).where(eq(reactions.messageId, row.id)),
  ]);
  const dto = toMessageDto(row, attachmentRows, reactionRows, null, toLinkPreviewDto(inserted));
  await publishEvent(row.conversationId, { type: "message.updated", payload: dto });
}

// Physical cleanup for disappearing messages — visibility is already
// enforced by the `notExpired` filter in listMessages, so this only reclaims
// storage and closes the gap for anyone with a chat open when a message
// expires. Called from the daily cron route; safe to call more than once.
export async function purgeExpiredMessages(): Promise<number> {
  const db = getDb();
  const expired = await db
    .select({ id: messages.id, conversationId: messages.conversationId })
    .from(messages)
    .where(and(isNotNull(messages.expiresAt), lte(messages.expiresAt, new Date())));
  if (expired.length === 0) return 0;

  await db.delete(messages).where(
    inArray(
      messages.id,
      expired.map((m) => m.id),
    ),
  );

  await Promise.all(
    expired.map((m) => publishEvent(m.conversationId, { type: "message.deleted", payload: { id: m.id, conversationId: m.conversationId } })),
  );

  return expired.length;
}
