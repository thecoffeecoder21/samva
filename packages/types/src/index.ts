export type ID = string;

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "contact"
  | "location"
  | "poll"
  | "link"
  | "system"
  | "call_event";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type MessageEffect = "confetti" | "balloons" | "hearts" | "fireworks";

export type ConversationType = "direct" | "group" | "channel";

export type ConversationRole = "owner" | "admin" | "member";

export interface Profile {
  id: ID;
  userId: ID;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  statusEmoji: string | null;
  statusText: string | null;
  isProfessional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: ID;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  description: string | null;
  isPublic: boolean;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ConversationMember {
  conversationId: ID;
  userId: ID;
  role: ConversationRole;
  joinedAt: string;
  mutedUntil: string | null;
  lastReadMessageId: ID | null;
}

export interface ConversationMemberSummary {
  userId: ID;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: ConversationRole;
}

export type MuteDuration = "1h" | "8h" | "always" | "off";

export interface Reaction {
  emoji: string;
  userId: ID;
}

export interface MessageAttachment {
  id: ID;
  url: string;
  mimeType: string;
  fileName: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface PollOption {
  id: ID;
  text: string;
  position: number;
  voteCount: number;
  votedByMe: boolean;
}

export interface Poll {
  id: ID;
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  totalVotes: number;
  options: PollOption[];
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface Message {
  id: ID;
  /** Monotonic per-conversation cursor (bigint serialized as string) backing pagination/ordering. */
  sequence: string;
  conversationId: ID;
  senderId: ID;
  type: MessageType;
  content: string | null;
  attachments: MessageAttachment[];
  poll: Poll | null;
  linkPreview: LinkPreview | null;
  expiresAt: string | null;
  effect: MessageEffect | null;
  replyToId: ID | null;
  threadRootId: ID | null;
  threadReplyCount: number;
  lastThreadReplyAt: string | null;
  reactions: Reaction[];
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  clientId: string | null;
}

export interface TypingEvent {
  conversationId: ID;
  userId: ID;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: ID;
  status: "online" | "offline";
  lastSeenAt: string | null;
}

export type RealtimeEvent =
  | { type: "message.created"; payload: Message }
  | { type: "message.updated"; payload: Message }
  | { type: "message.deleted"; payload: { id: ID; conversationId: ID } }
  | { type: "message.reaction"; payload: { messageId: ID; conversationId: ID; reactions: Reaction[] } }
  | { type: "typing.started"; payload: TypingEvent }
  | { type: "typing.stopped"; payload: TypingEvent }
  | { type: "presence.updated"; payload: PresenceEvent }
  | { type: "read.receipt"; payload: { conversationId: ID; userId: ID; messageId: ID } }
  | { type: "conversation.pinned"; payload: { conversationId: ID; messageId: ID | null } }
  | { type: "conversation.blocked"; payload: { conversationId: ID; blockedUserId: ID; blocked: boolean } }
  | { type: "poll.voted"; payload: { conversationId: ID; messageId: ID; poll: Poll } }
  | { type: "conversation.disappearing_updated"; payload: { conversationId: ID; disappearingSeconds: number | null } }
  | {
      type: "conversation.updated";
      payload: { conversationId: ID; name: string | null; avatarUrl: string | null; description: string | null; isPublic: boolean };
    }
  | { type: "conversation.member_added"; payload: { conversationId: ID; member: ConversationMemberSummary } }
  | { type: "conversation.member_removed"; payload: { conversationId: ID; userId: ID } }
  | { type: "conversation.member_role_changed"; payload: { conversationId: ID; userId: ID; role: ConversationRole } }
  | { type: "conversation.muted_updated"; payload: { conversationId: ID; userId: ID; mutedUntil: string | null } }
  | {
      type: "message.thread_reply";
      payload: { conversationId: ID; rootMessageId: ID; message: Message; threadReplyCount: number; lastThreadReplyAt: string };
    }
  | {
      type: "conversation.list_state_updated";
      payload: { conversationId: ID; userId: ID; isPinned: boolean; isArchived: boolean };
    }
  | { type: "message.reported"; payload: { conversationId: ID; messageId: ID } };
