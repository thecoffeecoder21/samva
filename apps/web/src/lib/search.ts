import "server-only";
import { and, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { conversationMembers, conversations, getDb, messages, profiles, users } from "@samva/db";

export interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationSearchResult {
  id: string;
  title: string;
  avatarUrl: string | null;
}

export interface MessageSearchResult {
  id: string;
  conversationId: string;
  conversationTitle: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export async function searchUsers(currentUserId: string, query: string): Promise<UserSearchResult[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: profiles.userId, username: profiles.username, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(and(ne(profiles.userId, currentUserId), or(ilike(profiles.username, `%${query}%`), ilike(profiles.displayName, `%${query}%`))))
    .limit(10);
  return rows;
}

export async function searchConversations(currentUserId: string, query: string): Promise<ConversationSearchResult[]> {
  const db = getDb();

  const memberships = await db
    .select({ conversation: conversations })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(eq(conversationMembers.userId, currentUserId));

  const results: ConversationSearchResult[] = [];
  const needle = query.toLowerCase();

  for (const { conversation } of memberships) {
    if (conversation.type === "direct") {
      const peer = await db
        .select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(and(eq(conversationMembers.conversationId, conversation.id), ne(conversationMembers.userId, currentUserId)))
        .then((rows) => rows[0]);
      if (peer && peer.displayName.toLowerCase().includes(needle)) {
        results.push({ id: conversation.id, title: peer.displayName, avatarUrl: peer.avatarUrl });
      }
    } else if (conversation.name?.toLowerCase().includes(needle)) {
      results.push({ id: conversation.id, title: conversation.name, avatarUrl: conversation.avatarUrl });
    }
  }

  return results.slice(0, 10);
}

export async function searchMessages(currentUserId: string, query: string): Promise<MessageSearchResult[]> {
  const db = getDb();

  const memberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, currentUserId));
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      content: messages.content,
      createdAt: messages.createdAt,
      senderName: profiles.displayName,
      conversationName: conversations.name,
      conversationType: conversations.type,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(profiles, eq(profiles.userId, messages.senderId))
    .where(and(ilike(messages.content, `%${query}%`), inArray(messages.conversationId, conversationIds)))
    .orderBy(desc(messages.sequence))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    conversationTitle: r.conversationType === "direct" ? r.senderName : (r.conversationName ?? "Conversation"),
    senderName: r.senderName,
    content: r.content ?? "",
    createdAt: r.createdAt.toISOString(),
  }));
}
