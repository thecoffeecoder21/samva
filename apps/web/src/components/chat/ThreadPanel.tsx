"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import { IconButton } from "@samva/ui";
import type { ConversationMemberSummary, Message, RealtimeEvent } from "@samva/types";
import { MessageBubble } from "./MessageBubble";

export function ThreadPanel({
  open,
  onClose,
  conversationId,
  rootMessageId,
  currentUserId,
  currentUsername,
  members,
  memberNames,
  onEvent,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  rootMessageId: string | null;
  currentUserId: string;
  currentUsername?: string;
  members: ConversationMemberSummary[];
  memberNames: Record<string, string>;
  /** Lets the parent forward `message.thread_reply` events (received on its
   * own conversation socket) into this panel while it's open, instead of
   * this panel opening a second redundant WebSocket. */
  onEvent: (handler: (event: RealtimeEvent) => void) => () => void;
}) {
  const [root, setRoot] = React.useState<Message | null>(null);
  const [replies, setReplies] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Reset to a loading state the instant a different thread is opened —
  // adjusting state during render (React's documented pattern) instead of an
  // effect, so the fetch effect below only ever sets state from its async
  // callbacks, never synchronously in the effect body.
  const [lastOpenedId, setLastOpenedId] = React.useState<string | null>(null);
  if (open && rootMessageId !== lastOpenedId) {
    setLastOpenedId(rootMessageId);
    setLoading(true);
    setRoot(null);
    setReplies([]);
  }

  React.useEffect(() => {
    if (!open || !rootMessageId) return;
    let cancelled = false;
    fetch(`/api/conversations/${conversationId}/messages/${rootMessageId}/thread`)
      .then((res) => res.json())
      .then((data: { root: Message; replies: Message[] }) => {
        if (cancelled) return;
        setRoot(data.root);
        setReplies(data.replies);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rootMessageId, conversationId]);

  React.useEffect(() => {
    if (!open || !rootMessageId) return;
    return onEvent((event) => {
      if (event.type === "message.thread_reply" && event.payload.rootMessageId === rootMessageId) {
        setReplies((prev) => (prev.some((m) => m.id === event.payload.message.id) ? prev : [...prev, event.payload.message]));
        setRoot((prev) => (prev ? { ...prev, threadReplyCount: event.payload.threadReplyCount } : prev));
      }
    });
  }, [open, rootMessageId, onEvent]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [replies.length]);

  if (!open || !rootMessageId) return null;

  async function submit() {
    const trimmed = draft.trim();
    if (!trimmed || !rootMessageId) return;
    setDraft("");
    const res = await fetch(`/api/conversations/${conversationId}/messages/${rootMessageId}/thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed, clientId: crypto.randomUUID() }),
    }).catch(() => null);
    if (res?.ok) {
      const { message } = (await res.json()) as { message: Message };
      setReplies((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }
  }

  return (
    <div className="flex h-full w-full max-w-sm flex-none flex-col border-l border-(--color-border) bg-(--color-surface)">
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <h2 className="text-sm font-semibold text-(--color-text-primary)">Thread</h2>
        <IconButton aria-label="Close thread" size="sm" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-(--color-text-tertiary)">Loading…</p>
        ) : (
          <>
            {root && (
              <div className="pb-3">
                <MessageBubble
                  message={root}
                  isOwn={root.senderId === currentUserId}
                  senderName={memberNames[root.senderId]}
                  currentUserId={currentUserId}
                  members={members}
                  currentUsername={currentUsername}
                  onReply={() => {}}
                  onReact={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onForward={() => {}}
                  onTogglePin={() => {}}
                  onVote={() => {}}
                />
                <div className="mt-2 border-b border-(--color-border) pb-2 text-xs text-(--color-text-tertiary)">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </div>
              </div>
            )}
            {replies.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.senderId === currentUserId}
                senderName={memberNames[m.senderId]}
                currentUserId={currentUserId}
                members={members}
                currentUsername={currentUsername}
                onReply={() => {}}
                onReact={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onForward={() => {}}
                onTogglePin={() => {}}
                onVote={() => {}}
              />
            ))}
          </>
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-(--color-border) px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Reply in thread…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-(--radius-md) border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
        />
        <IconButton aria-label="Send reply" onClick={submit}>
          <Send size={20} strokeWidth={1.75} className="text-(--color-primary)" />
        </IconButton>
      </div>
    </div>
  );
}
