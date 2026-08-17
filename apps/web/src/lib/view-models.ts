import type { ConversationType } from "@samva/types";

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
  isOnline?: boolean;
  /** The other member's user id, for direct conversations — lets realtime presence events be matched to the right row. */
  peerUserId?: string;
}
