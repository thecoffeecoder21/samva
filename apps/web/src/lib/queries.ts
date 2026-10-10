import "server-only";
import { and, count, desc, eq, gt, ilike, inArray, ne, or } from "drizzle-orm";
import {
  conversationFolderMembers,
  conversationFolders,
  conversationMembers,
  conversations,
  getDb,
  messages,
  polls,
  profiles,
  users,
} from "@samva/db";
import type { ConversationMemberSummary, ConversationRole, ConversationType } from "@samva/types";
import { getOnlineStatuses } from "./presence";
import { didIBlockThem, isBlocked } from "./blocks";
import type { ChannelSummary, ConversationFolder, ConversationSummary } from "./view-models";

type Db = ReturnType<typeof getDb>;

export async function getConversationSummaries(userId: string): Promise<ConversationSummary[]> {
  const db = getDb();

  const memberships = await db
    .select({
      conversation: conversations,
      mutedUntil: conversationMembers.mutedUntil,
      lastReadSequence: conversationMembers.lastReadSequence,
      pinnedAt: conversationMembers.pinnedAt,
      archivedAt: conversationMembers.archivedAt,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(eq(conversationMembers.userId, userId))
    .orderBy(desc(conversations.lastMessageAt));

  // Pinned conversations float to the top (most-recently-pinned first),
  // ahead of the normal recency ordering applied by the query above.
  memberships.sort((a, b) => {
    if (Boolean(a.pinnedAt) !== Boolean(b.pinnedAt)) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.getTime() - a.pinnedAt.getTime();
    return 0;
  });

  if (memberships.length === 0) return [];

  const conversationIds = memberships.map((m) => m.conversation.id);

  const [lastMessages, peers, unreadCounts] = await Promise.all([
    getLastMessages(db, conversationIds),
    getDirectPeers(db, conversationIds, userId),
    getUnreadCounts(db, memberships, userId),
  ]);

  const pollQuestions = await getPollQuestions(
    db,
    [...lastMessages.values()].filter((m) => m.type === "poll").map((m) => m.id),
  );

  const onlineStatuses = await getOnlineStatuses([...peers.values()].map((p) => p.userId));

  return memberships.map(({ conversation: c, mutedUntil, pinnedAt, archivedAt }) => {
    const last = lastMessages.get(c.id);
    const peer = peers.get(c.id);
    const isDirect = c.type === "direct";
    const preview = last?.type === "poll" ? `📊 ${pollQuestions.get(last.id) ?? "Poll"}` : (last?.content ?? null);
    return {
      id: c.id,
      type: c.type,
      title: isDirect ? (peer?.displayName ?? "Unknown user") : (c.name ?? "Untitled"),
      avatarUrl: isDirect ? (peer?.avatarUrl ?? null) : c.avatarUrl,
      lastMessagePreview: preview,
      lastMessageAt: (last?.createdAt ?? c.lastMessageAt)?.toISOString() ?? null,
      unreadCount: unreadCounts.get(c.id) ?? 0,
      isMuted: Boolean(mutedUntil && mutedUntil > new Date()),
      isPinned: Boolean(pinnedAt),
      isArchived: Boolean(archivedAt),
      isOnline: isDirect && peer ? (onlineStatuses.get(peer.userId) ?? false) : undefined,
      peerUserId: isDirect ? peer?.userId : undefined,
    } satisfies ConversationSummary;
  });
}

async function getLastMessages(db: Db, conversationIds: string[]) {
  const rows = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, conversationIds))
    .orderBy(desc(messages.sequence));

  const byConversation = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!byConversation.has(row.conversationId)) byConversation.set(row.conversationId, row);
  }
  return byConversation;
}

async function getPollQuestions(db: Db, messageIds: string[]) {
  const result = new Map<string, string>();
  if (messageIds.length === 0) return result;
  const rows = await db
    .select({ messageId: polls.messageId, question: polls.question })
    .from(polls)
    .where(inArray(polls.messageId, messageIds));
  for (const row of rows) result.set(row.messageId, row.question);
  return result;
}

async function getDirectPeers(db: Db, conversationIds: string[], userId: string) {
  const rows = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: conversationMembers.userId,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(inArray(conversationMembers.conversationId, conversationIds), ne(conversationMembers.userId, userId)));

  const byConversation = new Map<string, { userId: string; displayName: string; avatarUrl: string | null }>();
  for (const row of rows) {
    byConversation.set(row.conversationId, { userId: row.userId, displayName: row.displayName, avatarUrl: row.avatarUrl });
  }
  return byConversation;
}

export interface ConversationHeader {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl: string | null;
  description: string | null;
  isPublic: boolean;
  memberCount: number;
  myRole: ConversationRole;
  mutedUntil: string | null;
  peerUserId: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  pinnedMessageId: string | null;
  didIBlockPeer: boolean;
  conversationBlocked: boolean;
  disappearingSeconds: number | null;
}

/** Returns null if the conversation doesn't exist or `userId` isn't a member — callers should 404. */
export async function getConversationHeader(conversationId: string, userId: string): Promise<ConversationHeader | null> {
  const db = getDb();

  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
  });
  if (!membership) return null;

  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation) return null;

  const mutedUntil = membership.mutedUntil?.toISOString() ?? null;

  if (conversation.type !== "direct") {
    const [row] = await db
      .select({ value: count() })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.name ?? "Untitled",
      avatarUrl: conversation.avatarUrl,
      description: conversation.description,
      isPublic: conversation.isPublic,
      memberCount: row?.value ?? 1,
      myRole: membership.role,
      mutedUntil,
      peerUserId: null,
      isOnline: false,
      lastSeenAt: null,
      pinnedMessageId: conversation.pinnedMessageId,
      didIBlockPeer: false,
      conversationBlocked: false,
      disappearingSeconds: conversation.disappearingSeconds,
    };
  }

  const peers = await getDirectPeers(db, [conversationId], userId);
  const peer = peers.get(conversationId);
  const [onlineStatuses, peerProfile, didIBlockPeer, conversationBlocked] = await Promise.all([
    peer ? getOnlineStatuses([peer.userId]) : Promise.resolve(new Map<string, boolean>()),
    peer ? db.query.profiles.findFirst({ where: eq(profiles.userId, peer.userId) }) : Promise.resolve(null),
    peer ? didIBlockThem(userId, peer.userId) : Promise.resolve(false),
    peer ? isBlocked(userId, peer.userId) : Promise.resolve(false),
  ]);

  return {
    id: conversation.id,
    type: "direct",
    title: peer?.displayName ?? "Unknown user",
    avatarUrl: peer?.avatarUrl ?? null,
    description: null,
    isPublic: false,
    memberCount: 2,
    myRole: membership.role,
    mutedUntil,
    peerUserId: peer?.userId ?? null,
    isOnline: peer ? (onlineStatuses.get(peer.userId) ?? false) : false,
    lastSeenAt: peerProfile?.lastSeenAt?.toISOString() ?? null,
    pinnedMessageId: conversation.pinnedMessageId,
    didIBlockPeer,
    conversationBlocked,
    disappearingSeconds: conversation.disappearingSeconds,
  };
}

const ROLE_RANK: Record<ConversationRole, number> = { owner: 0, admin: 1, member: 2 };

export async function getConversationMembers(conversationId: string): Promise<ConversationMemberSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: conversationMembers.userId,
      role: conversationMembers.role,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.userId, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId));

  return rows.sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.displayName.localeCompare(b.displayName));
}

async function hydrateChannelSummaries(
  db: Db,
  channelRows: (typeof conversations.$inferSelect)[],
  userId: string,
): Promise<ChannelSummary[]> {
  if (channelRows.length === 0) return [];
  const ids = channelRows.map((c) => c.id);

  const memberRows = await db
    .select({ conversationId: conversationMembers.conversationId, userId: conversationMembers.userId, role: conversationMembers.role })
    .from(conversationMembers)
    .where(inArray(conversationMembers.conversationId, ids));

  const countByChannel = new Map<string, number>();
  const roleByChannelForUser = new Map<string, ConversationRole>();
  for (const m of memberRows) {
    countByChannel.set(m.conversationId, (countByChannel.get(m.conversationId) ?? 0) + 1);
    if (m.userId === userId) roleByChannelForUser.set(m.conversationId, m.role);
  }

  return channelRows.map((c) => ({
    id: c.id,
    name: c.name ?? "Untitled channel",
    avatarUrl: c.avatarUrl,
    description: c.description,
    isPublic: c.isPublic,
    memberCount: countByChannel.get(c.id) ?? 0,
    isFollowing: roleByChannelForUser.has(c.id),
    myRole: roleByChannelForUser.get(c.id) ?? null,
  }));
}

/** Public channel directory for the Discover page, optionally filtered by a search term. */
export async function getChannelDirectory(userId: string, query?: string): Promise<ChannelSummary[]> {
  const db = getDb();
  const trimmed = query?.trim();
  const conditions = [eq(conversations.type, "channel"), eq(conversations.isPublic, true)];
  if (trimmed) {
    conditions.push(
      or(ilike(conversations.name, `%${trimmed}%`), ilike(conversations.description, `%${trimmed}%`))!,
    );
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.createdAt))
    .limit(50);

  return hydrateChannelSummaries(db, rows, userId);
}

/** Channels (any visibility) the user is a member/follower of, for the Communities page. */
export async function getMyChannels(userId: string): Promise<ChannelSummary[]> {
  const db = getDb();
  const rows = await db
    .select({ conversation: conversations })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.userId, userId), eq(conversations.type, "channel")));

  return hydrateChannelSummaries(
    db,
    rows.map((r) => r.conversation),
    userId,
  );
}

export async function getConversationFolders(userId: string): Promise<ConversationFolder[]> {
  const db = getDb();
  const folderRows = await db
    .select()
    .from(conversationFolders)
    .where(eq(conversationFolders.userId, userId))
    .orderBy(conversationFolders.position, conversationFolders.createdAt);
  if (folderRows.length === 0) return [];

  const memberRows = await db
    .select({ folderId: conversationFolderMembers.folderId, conversationId: conversationFolderMembers.conversationId })
    .from(conversationFolderMembers)
    .where(inArray(conversationFolderMembers.folderId, folderRows.map((f) => f.id)));

  const conversationIdsByFolder = new Map<string, string[]>();
  for (const row of memberRows) {
    const list = conversationIdsByFolder.get(row.folderId);
    if (list) list.push(row.conversationId);
    else conversationIdsByFolder.set(row.folderId, [row.conversationId]);
  }

  return folderRows.map((f) => ({
    id: f.id,
    name: f.name,
    position: f.position,
    conversationIds: conversationIdsByFolder.get(f.id) ?? [],
  }));
}

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  statusEmoji: string | null;
  statusText: string | null;
}

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const db = getDb();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.username, username.toLowerCase()) });
  if (!profile) return null;
  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    statusEmoji: profile.statusEmoji,
    statusText: profile.statusText,
  };
}

async function getUnreadCounts(
  db: Db,
  memberships: { conversation: { id: string }; lastReadSequence: bigint | null }[],
  userId: string,
) {
  const result = new Map<string, number>();
  await Promise.all(
    memberships.map(async ({ conversation, lastReadSequence }) => {
      const [row] = await db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            ne(messages.senderId, userId),
            gt(messages.sequence, lastReadSequence ?? BigInt(0)),
          ),
        );
      result.set(conversation.id, row?.value ?? 0);
    }),
  );
  return result;
}
