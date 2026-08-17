"use client";

import * as React from "react";
import { Reply, Forward, SmilePlus, MoreHorizontal, Pencil, Trash2, Clock, Check, CheckCheck, AlertCircle, Pin, Timer } from "lucide-react";
import { cn, IconButton } from "@samva/ui";
import type { Message } from "@samva/types";
import { MessageAttachments } from "./MessageAttachments";
import { PollMessage } from "./PollMessage";
import { LinkPreviewCard } from "./LinkPreviewCard";

const QUICK_REACTIONS = ["❤️", "😂", "🔥", "👍", "👏", "😮"];

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isReadByPeer?: boolean;
  isPinned?: boolean;
  senderName?: string;
  replyToMessage?: Message | null;
  currentUserId: string;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onForward: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onVote: (message: Message, optionId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isReadByPeer,
  isPinned,
  senderName,
  replyToMessage,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onForward,
  onTogglePin,
  onVote,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const deleted = Boolean(message.deletedAt);

  const reactionCounts = React.useMemo(() => {
    const counts = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of message.reactions) {
      const entry = counts.get(r.emoji) ?? { count: 0, reactedByMe: false };
      entry.count += 1;
      if (r.userId === currentUserId) entry.reactedByMe = true;
      counts.set(r.emoji, entry);
    }
    return counts;
  }, [message.reactions, currentUserId]);

  return (
    <div className={cn("group flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
      <div className={cn("flex max-w-[75%] items-end gap-2", isOwn && "flex-row-reverse")}>
        <div
          className={cn(
            "relative rounded-(--radius-lg) px-3.5 py-2 text-sm leading-relaxed",
            isOwn
              ? "rounded-br-sm bg-(--color-bubble-outgoing) text-(--color-bubble-outgoing-fg)"
              : "rounded-bl-sm bg-(--color-bubble-incoming) text-(--color-bubble-incoming-fg)",
          )}
        >
          {senderName && !isOwn && (
            <p className="mb-0.5 text-xs font-medium text-(--color-primary)">{senderName}</p>
          )}
          {replyToMessage && (
            <div
              className={cn(
                "mb-1.5 rounded-(--radius-sm) border-l-2 px-2 py-1 text-xs opacity-80",
                isOwn ? "border-white/40" : "border-(--color-primary)",
              )}
            >
              {replyToMessage.deletedAt ? "Message deleted" : (replyToMessage.content ?? "Attachment")}
            </div>
          )}
          {deleted ? (
            <p className="italic opacity-60">Message deleted</p>
          ) : message.type === "poll" && message.poll ? (
            <PollMessage poll={message.poll} isOwn={isOwn} onVote={(optionId) => onVote(message, optionId)} />
          ) : (
            <>
              <MessageAttachments message={message} isOwn={isOwn} />
              {message.linkPreview && <LinkPreviewCard preview={message.linkPreview} isOwn={isOwn} />}
              {message.content && (
                <p className={cn("whitespace-pre-wrap break-words", message.attachments.length > 0 && "mt-1.5")}>
                  {message.content}
                </p>
              )}
            </>
          )}
          <div className={cn("mt-1 flex items-center gap-1 text-[10px] opacity-60", isOwn && "justify-end")}>
            {message.expiresAt && <Timer size={10} aria-label="Disappearing message" />}
            <span suppressHydrationWarning>{formatTime(message.createdAt)}</span>
            {message.editedAt && <span>· edited</span>}
            {isOwn && <MessageStatusIcon status={message.status} isReadByPeer={isReadByPeer} />}
          </div>
        </div>

        {!deleted && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100">
            <div className="relative">
              <IconButton aria-label="React" size="sm" onClick={() => setPickerOpen((v) => !v)}>
                <SmilePlus size={16} />
              </IconButton>
              {pickerOpen && (
                <div className="absolute z-10 mt-1 flex gap-1 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-md)">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className="rounded-(--radius-sm) px-1.5 py-1 text-base hover:bg-(--color-surface-raised)"
                      onClick={() => {
                        onReact(message, emoji);
                        setPickerOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <IconButton aria-label="Reply" size="sm" onClick={() => onReply(message)}>
              <Reply size={16} />
            </IconButton>
            <IconButton aria-label="Forward" size="sm" onClick={() => onForward(message)}>
              <Forward size={16} />
            </IconButton>
            <div className="relative">
              <IconButton aria-label="More options" size="sm" onClick={() => setMenuOpen((v) => !v)}>
                <MoreHorizontal size={16} />
              </IconButton>
              {menuOpen && (
                <div className="absolute right-0 z-10 mt-1 flex w-36 flex-col rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-md)">
                  <button
                    className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                    onClick={() => {
                      onTogglePin(message);
                      setMenuOpen(false);
                    }}
                  >
                    <Pin size={14} /> {isPinned ? "Unpin" : "Pin"}
                  </button>
                  {isOwn && (
                    <button
                      className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                      onClick={() => {
                        onEdit(message);
                        setMenuOpen(false);
                      }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  {isOwn && (
                    <button
                      className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs text-(--color-danger) hover:bg-(--color-surface-raised)"
                      onClick={() => {
                        onDelete(message);
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reactionCounts.size > 0 && (
        <div className={cn("flex flex-wrap gap-1", isOwn && "justify-end")}>
          {Array.from(reactionCounts.entries()).map(([emoji, { count, reactedByMe }]) => (
            <button
              key={emoji}
              onClick={() => onReact(message, emoji)}
              className={cn(
                "flex items-center gap-1 rounded-(--radius-full) border px-1.5 py-0.5 text-xs",
                reactedByMe
                  ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
                  : "border-(--color-border) text-(--color-text-secondary)",
              )}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function MessageStatusIcon({ status, isReadByPeer }: { status: Message["status"]; isReadByPeer?: boolean }) {
  if (status === "sending") return <Clock size={11} />;
  if (status === "failed") return <AlertCircle size={11} className="text-(--color-danger)" />;
  if (isReadByPeer) return <CheckCheck size={13} className="text-sky-300" />;
  return <Check size={11} />;
}
