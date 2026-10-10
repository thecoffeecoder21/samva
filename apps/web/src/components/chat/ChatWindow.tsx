"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pin, Timer, X, ArrowDown, UploadCloud } from "lucide-react";
import { TypingIndicator } from "@samva/ui";
import type {
  ConversationMemberSummary,
  ConversationRole,
  ConversationType,
  Message,
  MessageAttachment,
  MessageEffect,
  MessageType,
  MuteDuration,
  Poll,
  RealtimeEvent,
} from "@samva/types";
import { useConversationSocket } from "@/lib/realtime/useConversationSocket";
import { classifyFile, uploadAttachment } from "@/lib/uploadFile";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ForwardDialog } from "./ForwardDialog";
import { PollComposerDialog } from "./PollComposerDialog";
import { MessageEffectOverlay } from "./MessageEffectOverlay";
import { ManageConversationDialog } from "./ManageConversationDialog";
import { ThreadPanel } from "./ThreadPanel";
import { ReportMessageDialog } from "./ReportMessageDialog";

export interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  conversationType: ConversationType;
  title: string;
  avatarUrl: string | null;
  peerUserId: string | null;
  initialIsOnline: boolean;
  initialLastSeenAt: string | null;
  initialPinnedMessageId: string | null;
  initialDidIBlockPeer: boolean;
  initialConversationBlocked: boolean;
  initialDisappearingSeconds: number | null;
  initialDescription: string | null;
  initialIsPublic: boolean;
  initialMyRole: ConversationRole;
  initialMutedUntil: string | null;
  initialMessages: Message[];
  members: ConversationMemberSummary[];
  currentUsername?: string;
}

export function ChatWindow({
  conversationId,
  currentUserId,
  conversationType,
  title,
  avatarUrl,
  peerUserId,
  initialIsOnline,
  initialLastSeenAt,
  initialPinnedMessageId,
  initialDidIBlockPeer,
  initialConversationBlocked,
  initialDisappearingSeconds,
  initialDescription,
  initialIsPublic,
  initialMyRole,
  initialMutedUntil,
  initialMessages,
  members,
  currentUsername,
}: ChatWindowProps) {
  const memberNames = React.useMemo(
    () => Object.fromEntries(members.map((m) => [m.userId, m.displayName])),
    [members],
  );
  const [openThreadRootId, setOpenThreadRootId] = React.useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = React.useState<Message | null>(null);
  const threadListenersRef = React.useRef<Set<(event: RealtimeEvent) => void>>(new Set());
  const subscribeThreadEvents = React.useCallback((handler: (event: RealtimeEvent) => void) => {
    threadListenersRef.current.add(handler);
    return () => {
      threadListenersRef.current.delete(handler);
    };
  }, []);
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [disappearingSeconds, setDisappearingSeconds] = React.useState(initialDisappearingSeconds);
  const [convName, setConvName] = React.useState(title);
  const [convAvatarUrl, setConvAvatarUrl] = React.useState(avatarUrl);
  const [convDescription, setConvDescription] = React.useState(initialDescription);
  const [convIsPublic, setConvIsPublic] = React.useState(initialIsPublic);
  const [myRole, setMyRole] = React.useState<ConversationRole>(initialMyRole);
  const [mutedUntil, setMutedUntil] = React.useState(initialMutedUntil);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [editing, setEditing] = React.useState<Message | null>(null);
  const [forwarding, setForwarding] = React.useState<Message | null>(null);
  const [pollComposerOpen, setPollComposerOpen] = React.useState(false);
  const [activeEffect, setActiveEffect] = React.useState<MessageEffect | null>(null);
  const [typingUsers, setTypingUsers] = React.useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [peerPresence, setPeerPresence] = React.useState({ isOnline: initialIsOnline, lastSeenAt: initialLastSeenAt });
  const [peerReadSequence, setPeerReadSequence] = React.useState<bigint>(BigInt(0));
  const [pinnedMessageId, setPinnedMessageId] = React.useState(initialPinnedMessageId);
  const [didIBlockPeer, setDidIBlockPeer] = React.useState(initialDidIBlockPeer);
  const [conversationBlocked, setConversationBlocked] = React.useState(initialConversationBlocked);
  const [isNearBottom, setIsNearBottom] = React.useState(true);
  const [newMessageCount, setNewMessageCount] = React.useState(0);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const isNearBottomRef = React.useRef(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const typingClearTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messagesRef = React.useRef(messages);
  React.useEffect(() => {
    messagesRef.current = messages;
  });

  const handleEvent = React.useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "message.created": {
          // Computed from the ref (reflecting state as of just before this
          // event) rather than from inside the setMessages updater below —
          // React doesn't guarantee that updater runs synchronously, so a
          // flag mutated inside it and read right after would often still
          // hold its stale initial value here.
          const current = messagesRef.current;
          const isNewArrival =
            !current.some((m) => m.id === event.payload.id) ||
            current.some((m) => m.clientId && m.clientId === event.payload.clientId && m.id !== event.payload.id);
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.clientId && m.clientId === event.payload.clientId);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = event.payload;
              return next;
            }
            if (prev.some((m) => m.id === event.payload.id)) return prev;
            return [...prev, event.payload];
          });
          if (isNewArrival && event.payload.effect) {
            setActiveEffect(event.payload.effect);
          }
          break;
        }
        case "message.updated": {
          const updated = event.payload;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          break;
        }
        case "message.deleted": {
          const { id } = event.payload;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), content: null } : m)),
          );
          break;
        }
        case "message.reaction": {
          const { messageId, reactions } = event.payload;
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
          break;
        }
        case "typing.started":
        case "typing.stopped": {
          const { userId } = event.payload;
          if (userId === currentUserId) return;
          const isTyping = event.type === "typing.started";
          setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
          clearTimeout(typingClearTimers.current[userId]);
          if (isTyping) {
            typingClearTimers.current[userId] = setTimeout(() => {
              setTypingUsers((prev) => ({ ...prev, [userId]: false }));
            }, 5000);
          }
          break;
        }
        case "presence.updated": {
          const { userId, status, lastSeenAt } = event.payload;
          if (userId !== peerUserId) return;
          setPeerPresence({ isOnline: status === "online", lastSeenAt });
          break;
        }
        case "read.receipt": {
          const { userId, messageId } = event.payload;
          if (userId !== peerUserId) return;
          const sequence = messagesRef.current.find((m) => m.id === messageId)?.sequence;
          if (!sequence) return;
          setPeerReadSequence((prev) => {
            const next = BigInt(sequence);
            return next > prev ? next : prev;
          });
          break;
        }
        case "conversation.pinned": {
          setPinnedMessageId(event.payload.messageId);
          break;
        }
        case "conversation.disappearing_updated": {
          setDisappearingSeconds(event.payload.disappearingSeconds);
          break;
        }
        case "poll.voted": {
          const { messageId, poll } = event.payload;
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, poll } : m)));
          break;
        }
        case "conversation.blocked": {
          // Either side blocking restricts the conversation for both, but
          // only the blocker sees the "you blocked them" affordance — see
          // didIBlockPeer, which this event doesn't touch (it's only set by
          // this browser's own toggleBlock call).
          setConversationBlocked(event.payload.blocked);
          break;
        }
        case "conversation.updated": {
          setConvName(event.payload.name ?? "Untitled");
          setConvAvatarUrl(event.payload.avatarUrl);
          setConvDescription(event.payload.description);
          setConvIsPublic(event.payload.isPublic);
          break;
        }
        case "conversation.member_role_changed": {
          if (event.payload.userId === currentUserId) setMyRole(event.payload.role);
          break;
        }
        case "conversation.member_removed": {
          if (event.payload.userId === currentUserId) {
            router.push("/chats");
            router.refresh();
          }
          break;
        }
        case "conversation.muted_updated": {
          if (event.payload.userId === currentUserId) setMutedUntil(event.payload.mutedUntil);
          break;
        }
        case "message.thread_reply": {
          const { rootMessageId, threadReplyCount, lastThreadReplyAt } = event.payload;
          setMessages((prev) =>
            prev.map((m) => (m.id === rootMessageId ? { ...m, threadReplyCount, lastThreadReplyAt } : m)),
          );
          break;
        }
      }
      for (const listener of threadListenersRef.current) listener(event);
    },
    [currentUserId, peerUserId, router],
  );

  const { sendTyping } = useConversationSocket(conversationId, handleEvent);

  const prevMessageCountRef = React.useRef(messages.length);
  React.useEffect(() => {
    const delta = messages.length - prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (delta <= 0) return;
    const last = messages[messages.length - 1];
    const isOwnMessage = last?.senderId === currentUserId;
    if (isOwnMessage || isNearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      setNewMessageCount(0);
    } else {
      setNewMessageCount((n) => n + delta);
    }
  }, [messages, currentUserId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessageCount(0);
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setNewMessageCount(0);
  }

  // Hides a disappearing message on this device the instant its timer runs
  // out, without waiting for the daily cron purge or a page reload —
  // visibility is also enforced server-side (listMessages filters expired
  // rows), this is just so an open chat doesn't show a stale message.
  React.useEffect(() => {
    const hasTimedMessages = messages.some((m) => m.expiresAt);
    if (!hasTimedMessages) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now));
    }, 5000);
    return () => clearInterval(interval);
  }, [messages]);

  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.status === "sending" || last.status === "failed") return;
    fetch(`/api/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: last.id, sequence: last.sequence }),
    }).catch(() => {});
  }, [messages, conversationId]);

  async function sendMessagePayload(payload: {
    type: MessageType;
    content: string | null;
    attachments: MessageAttachment[];
    effect?: MessageEffect | null;
  }) {
    const clientId = crypto.randomUUID();
    const replyToId = replyTo?.id ?? null;
    const optimistic: Message = {
      id: clientId,
      sequence: "0",
      conversationId,
      senderId: currentUserId,
      type: payload.type,
      content: payload.content,
      attachments: payload.attachments,
      poll: null,
      linkPreview: null,
      expiresAt: null,
      effect: payload.effect ?? null,
      replyToId,
      threadRootId: null,
      threadReplyCount: 0,
      lastThreadReplyAt: null,
      reactions: [],
      status: "sending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      clientId,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, replyToId, clientId }),
      });
      if (!res.ok) throw new Error("send failed");
      const { message } = (await res.json()) as { message: Message };
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? message : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed" } : m)));
    }
  }

  async function sendMessage(content: string, effect?: MessageEffect | null) {
    await sendMessagePayload({ type: "text", content, attachments: [], effect });
  }

  async function sendFile(file: File) {
    const { kind, type } = classifyFile(file.type);
    setUploadProgress(0);
    try {
      const attachment = await uploadAttachment(file, file.name, conversationId, kind, setUploadProgress);
      await sendMessagePayload({ type, content: null, attachments: [attachment] });
    } catch {
      // Upload failed silently for the user beyond the progress bar
      // disappearing — retrying is just re-picking the file.
    } finally {
      setUploadProgress(null);
    }
  }

  async function sendVoiceNote(blob: Blob, durationMs: number, mimeType: string) {
    setUploadProgress(0);
    try {
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mimeType });
      const attachment = await uploadAttachment(
        file,
        file.name,
        conversationId,
        "audio",
        setUploadProgress,
        mimeType,
      );
      await sendMessagePayload({
        type: "voice",
        content: null,
        attachments: [{ ...attachment, durationMs }],
      });
    } finally {
      setUploadProgress(null);
    }
  }

  async function sendPoll(question: string, options: string[], allowMultiple: boolean) {
    const clientId = crypto.randomUUID();
    const optimisticPoll: Poll = {
      id: clientId,
      question,
      allowMultiple,
      closesAt: null,
      totalVotes: 0,
      options: options.map((text, i) => ({
        id: `${clientId}-${i}`,
        text,
        position: i,
        voteCount: 0,
        votedByMe: false,
      })),
    };
    const optimistic: Message = {
      id: clientId,
      sequence: "0",
      conversationId,
      senderId: currentUserId,
      type: "poll",
      content: null,
      attachments: [],
      poll: optimisticPoll,
      linkPreview: null,
      expiresAt: null,
      effect: null,
      replyToId: null,
      threadRootId: null,
      threadReplyCount: 0,
      lastThreadReplyAt: null,
      reactions: [],
      status: "sending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      clientId,
    };
    setMessages((prev) => [...prev, optimistic]);
    setPollComposerOpen(false);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "poll", clientId, poll: { question, options, allowMultiple } }),
      });
      if (!res.ok) throw new Error("send failed");
      const { message } = (await res.json()) as { message: Message };
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? message : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed" } : m)));
    }
  }

  async function votePoll(message: Message, optionId: string) {
    if (!message.poll) return;
    const res = await fetch(`/api/polls/${message.poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    if (res.ok) {
      const { poll } = (await res.json()) as { poll: Poll };
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, poll } : m)));
    }
  }

  async function forwardMessage(targetConversationId: string) {
    if (!forwarding) return;
    // Forwarding a poll starts a fresh one in the target conversation — votes
    // don't carry over, only the question and option text.
    const poll = forwarding.poll
      ? { question: forwarding.poll.question, options: forwarding.poll.options.map((o) => o.text), allowMultiple: forwarding.poll.allowMultiple }
      : undefined;
    await fetch(`/api/conversations/${targetConversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: forwarding.type,
        content: forwarding.content,
        attachments: forwarding.attachments,
        poll,
        clientId: crypto.randomUUID(),
      }),
    }).catch(() => {});
  }

  async function toggleBlock() {
    const willUnblock = didIBlockPeer;
    setDidIBlockPeer(!willUnblock);
    setConversationBlocked(!willUnblock);
    await fetch(`/api/conversations/${conversationId}/block`, {
      method: willUnblock ? "DELETE" : "POST",
    }).catch(() => {});
  }

  async function setDisappearing(seconds: 3600 | 86400 | 604800 | null) {
    setDisappearingSeconds(seconds);
    await fetch(`/api/conversations/${conversationId}/disappearing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds }),
    }).catch(() => {});
  }

  async function setMute(duration: MuteDuration) {
    const res = await fetch(`/api/conversations/${conversationId}/mute`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration }),
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { mutedUntil: string | null };
      setMutedUntil(data.mutedUntil);
    }
  }

  async function saveEdit(messageId: string, content: string) {
    setEditing(null);
    const res = await fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const { message } = (await res.json()) as { message: Message };
      setMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)));
    }
  }

  async function deleteMessage(message: Message) {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deletedAt: new Date().toISOString(), content: null } : m)),
    );
    await fetch(`/api/messages/${message.id}`, { method: "DELETE" }).catch(() => {});
  }

  async function togglePin(message: Message) {
    const willUnpin = pinnedMessageId === message.id;
    setPinnedMessageId(willUnpin ? null : message.id);
    if (willUnpin) {
      await fetch(`/api/conversations/${conversationId}/pin`, { method: "DELETE" }).catch(() => {});
    } else {
      await fetch(`/api/conversations/${conversationId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      }).catch(() => {});
    }
  }

  function editLastOwnMessage() {
    const lastOwnText = [...messages].reverse().find((m) => m.senderId === currentUserId && m.type === "text" && !m.deletedAt);
    if (lastOwnText) setEditing(lastOwnText);
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) sendFile(file);
  }

  async function reportMessage(message: Message, reason: string) {
    setReportingMessage(null);
    await fetch(`/api/messages/${message.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  }

  async function react(message: Message, emoji: string) {
    const res = await fetch(`/api/messages/${message.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const { reactions } = (await res.json()) as { reactions: Message["reactions"] };
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions } : m)));
    }
  }

  const messageById = React.useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const typingNames = Object.entries(typingUsers)
    .filter(([, isTyping]) => isTyping)
    .map(([userId]) => memberNames[userId] ?? "Someone");

  const presenceSubtitle = peerUserId
    ? peerPresence.isOnline
      ? "Online"
      : peerPresence.lastSeenAt
        ? `Last seen ${formatLastSeen(peerPresence.lastSeenAt)}`
        : undefined
    : undefined;

  const pinnedMessage = pinnedMessageId ? (messageById.get(pinnedMessageId) ?? null) : null;
  const isMuted = Boolean(mutedUntil && new Date(mutedUntil) > new Date());
  const isReadOnlyChannel = conversationType === "channel" && myRole === "member";

  return (
    <div className="flex h-full">
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-(--color-primary) bg-(--color-bg)/90 text-(--color-primary)">
          <UploadCloud size={32} />
          <p className="text-sm font-medium">Drop to send</p>
        </div>
      )}
      <ChatHeader
        title={convName}
        avatarUrl={convAvatarUrl}
        subtitle={presenceSubtitle}
        isOnline={peerPresence.isOnline}
        showBlockOption={Boolean(peerUserId)}
        isBlockedByMe={didIBlockPeer}
        onToggleBlock={toggleBlock}
        disappearingSeconds={disappearingSeconds}
        onSetDisappearing={setDisappearing}
        isMuted={isMuted}
        onSetMute={setMute}
        conversationType={conversationType}
        onOpenInfo={conversationType !== "direct" ? () => setManageOpen(true) : undefined}
      />
      {disappearingSeconds && (
        <div className="flex items-center gap-2 border-b border-(--color-border) bg-(--color-surface-raised) px-4 py-2 text-xs text-(--color-text-secondary)">
          <Timer size={14} className="shrink-0 text-(--color-primary)" />
          New messages disappear after {formatDuration(disappearingSeconds)}.
        </div>
      )}
      {pinnedMessageId && (
        <div className="flex items-center gap-2 border-b border-(--color-border) bg-(--color-surface-raised) px-4 py-2 text-xs">
          <Pin size={14} className="shrink-0 text-(--color-primary)" />
          <span className="min-w-0 flex-1 truncate text-(--color-text-secondary)">
            <span className="font-medium text-(--color-text-primary)">Pinned: </span>
            {pinnedMessage ? (pinnedMessage.content ?? "Attachment") : "Message"}
          </span>
          <button
            onClick={() => pinnedMessage && togglePin(pinnedMessage)}
            className="shrink-0 text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            aria-label="Unpin message"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="message-list"
          className="h-full space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={m.senderId === currentUserId}
              isReadByPeer={Boolean(peerUserId) && BigInt(m.sequence) <= peerReadSequence}
              isPinned={pinnedMessageId === m.id}
              senderName={memberNames[m.senderId]}
              replyToMessage={m.replyToId ? (messageById.get(m.replyToId) ?? null) : null}
              currentUserId={currentUserId}
              members={members}
              currentUsername={currentUsername}
              onReply={setReplyTo}
              onReact={react}
              onEdit={setEditing}
              onDelete={deleteMessage}
              onForward={setForwarding}
              onTogglePin={togglePin}
              onVote={votePoll}
              onOpenThread={(msg) => setOpenThreadRootId(msg.id)}
              onReport={conversationType === "channel" ? setReportingMessage : undefined}
            />
          ))}
        </div>
        {!isNearBottom && (
          <button
            onClick={scrollToBottom}
            aria-label="Scroll to latest messages"
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-(--radius-full) border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-xs font-medium text-(--color-text-primary) shadow-(--shadow-md) hover:bg-(--color-surface-raised)"
          >
            {newMessageCount > 0 && (
              <span className="rounded-(--radius-full) bg-(--color-primary) px-1.5 py-0.5 text-[10px] text-(--color-primary-fg)">
                {newMessageCount}
              </span>
            )}
            <ArrowDown size={14} />
          </button>
        )}
      </div>
      {typingNames.length > 0 && (
        <div className="px-4 pb-1">
          <TypingIndicator names={typingNames} />
        </div>
      )}
      {conversationBlocked ? (
        <div className="border-t border-(--color-border) bg-(--color-surface) px-4 py-3 text-center text-sm text-(--color-text-tertiary)">
          {didIBlockPeer
            ? "You blocked this user. Unblock them to send messages again."
            : "You can't reply to this conversation."}
        </div>
      ) : isReadOnlyChannel ? (
        <div className="border-t border-(--color-border) bg-(--color-surface) px-4 py-3 text-center text-sm text-(--color-text-tertiary)">
          Only owners and admins can post in this channel.
        </div>
      ) : (
        <MessageComposer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editingMessage={editing}
          onCancelEdit={() => setEditing(null)}
          onSend={sendMessage}
          onSaveEdit={saveEdit}
          onTyping={sendTyping}
          onSendFile={sendFile}
          onSendVoiceNote={sendVoiceNote}
          onCreatePoll={() => setPollComposerOpen(true)}
          onEditLast={editLastOwnMessage}
          uploadProgress={uploadProgress}
          members={members}
        />
      )}
      <ForwardDialog
        open={Boolean(forwarding)}
        onClose={() => setForwarding(null)}
        onForward={forwardMessage}
        excludeConversationId={conversationId}
      />
      <PollComposerDialog
        open={pollComposerOpen}
        onClose={() => setPollComposerOpen(false)}
        onCreate={sendPoll}
      />
      {activeEffect && <MessageEffectOverlay effect={activeEffect} onDone={() => setActiveEffect(null)} />}
      {conversationType !== "direct" && (
        <ManageConversationDialog
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          conversationId={conversationId}
          type={conversationType}
          currentUserId={currentUserId}
          myRole={myRole}
          name={convName}
          avatarUrl={convAvatarUrl}
          description={convDescription}
          isPublic={convIsPublic}
          onUpdated={(patch) => {
            if (patch.name !== undefined) setConvName(patch.name);
            if (patch.avatarUrl !== undefined) setConvAvatarUrl(patch.avatarUrl);
            if (patch.description !== undefined) setConvDescription(patch.description);
            if (patch.isPublic !== undefined) setConvIsPublic(patch.isPublic);
          }}
        />
      )}
      <ReportMessageDialog
        open={Boolean(reportingMessage)}
        onClose={() => setReportingMessage(null)}
        onSubmit={(reason) => reportingMessage && reportMessage(reportingMessage, reason)}
      />
    </div>
    {openThreadRootId && (
      <ThreadPanel
        open={Boolean(openThreadRootId)}
        onClose={() => setOpenThreadRootId(null)}
        conversationId={conversationId}
        rootMessageId={openThreadRootId}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        members={members}
        memberNames={memberNames}
        onEvent={subscribeThreadEvents}
      />
    )}
    </div>
  );
}

function formatLastSeen(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number) {
  if (seconds >= 604800) return "1 week";
  if (seconds >= 86400) return "1 day";
  return "1 hour";
}
