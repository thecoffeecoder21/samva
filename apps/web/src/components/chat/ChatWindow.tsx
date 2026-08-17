"use client";

import * as React from "react";
import { Pin, Timer, X } from "lucide-react";
import { TypingIndicator } from "@samva/ui";
import type { Message, MessageAttachment, MessageEffect, MessageType, Poll, RealtimeEvent } from "@samva/types";
import { useConversationSocket } from "@/lib/realtime/useConversationSocket";
import { classifyFile, uploadAttachment } from "@/lib/uploadFile";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ForwardDialog } from "./ForwardDialog";
import { PollComposerDialog } from "./PollComposerDialog";
import { MessageEffectOverlay } from "./MessageEffectOverlay";

export interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  title: string;
  avatarUrl: string | null;
  peerUserId: string | null;
  initialIsOnline: boolean;
  initialLastSeenAt: string | null;
  initialPinnedMessageId: string | null;
  initialDidIBlockPeer: boolean;
  initialConversationBlocked: boolean;
  initialDisappearingSeconds: number | null;
  initialMessages: Message[];
  memberNames: Record<string, string>;
}

export function ChatWindow({
  conversationId,
  currentUserId,
  title,
  avatarUrl,
  peerUserId,
  initialIsOnline,
  initialLastSeenAt,
  initialPinnedMessageId,
  initialDidIBlockPeer,
  initialConversationBlocked,
  initialDisappearingSeconds,
  initialMessages,
  memberNames,
}: ChatWindowProps) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [disappearingSeconds, setDisappearingSeconds] = React.useState(initialDisappearingSeconds);
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
      }
    },
    [currentUserId, peerUserId],
  );

  const { sendTyping } = useConversationSocket(conversationId, handleEvent);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

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

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        title={title}
        avatarUrl={avatarUrl}
        subtitle={presenceSubtitle}
        isOnline={peerPresence.isOnline}
        showBlockOption={Boolean(peerUserId)}
        isBlockedByMe={didIBlockPeer}
        onToggleBlock={toggleBlock}
        disappearingSeconds={disappearingSeconds}
        onSetDisappearing={setDisappearing}
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
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
            onReply={setReplyTo}
            onReact={react}
            onEdit={setEditing}
            onDelete={deleteMessage}
            onForward={setForwarding}
            onTogglePin={togglePin}
            onVote={votePoll}
          />
        ))}
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
          uploadProgress={uploadProgress}
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
