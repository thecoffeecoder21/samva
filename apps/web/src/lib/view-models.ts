import type { ConversationRole, ConversationType } from "@samva/types";

/** Denormalized view-model for a conversation list row — joins conversation + last message + peer profile. */
export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isOnline?: boolean;
  /** The other member's user id, for direct conversations — lets realtime presence events be matched to the right row. */
  peerUserId?: string;
}

/** A user's personal chat-list folder/label, with the conversations currently filed under it. */
export interface ConversationFolder {
  id: string;
  name: string;
  position: number;
  conversationIds: string[];
}

/** Denormalized view-model for a channel row — used by the Discover directory and the Communities ("my channels") list. */
export interface ChannelSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  isPublic: boolean;
  memberCount: number;
  isFollowing: boolean;
  myRole: ConversationRole | null;
}
