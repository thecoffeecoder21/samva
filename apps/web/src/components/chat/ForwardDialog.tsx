"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Avatar, IconButton } from "@samva/ui";
import type { ConversationSummary } from "@/lib/view-models";

export function ForwardDialog({
  open,
  onClose,
  onForward,
  excludeConversationId,
}: {
  open: boolean;
  onClose: () => void;
  onForward: (conversationId: string) => void;
  excludeConversationId: string;
}) {
  const [conversations, setConversations] = React.useState<ConversationSummary[] | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  // Reset the "sent" indicator the moment the dialog re-opens — adjusting
  // state during render (React's documented pattern) rather than an effect.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSentTo(null);
  }

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data: { conversations: ConversationSummary[] }) => setConversations(data.conversations))
      .catch(() => setConversations([]));
  }, [open]);

  if (!open) return null;

  const options = (conversations ?? []).filter((c) => c.id !== excludeConversationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-4 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Forward to…</h2>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="px-2 py-4 text-sm text-(--color-text-tertiary)">Loading…</p>
          ) : options.length === 0 ? (
            <p className="px-2 py-4 text-sm text-(--color-text-tertiary)">No other conversations yet.</p>
          ) : (
            options.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onForward(c.id);
                  setSentTo(c.id);
                }}
                disabled={sentTo === c.id}
                className="flex w-full items-center gap-3 rounded-(--radius-md) px-2 py-2 text-left hover:bg-(--color-surface-raised) disabled:opacity-50"
              >
                <Avatar src={c.avatarUrl} name={c.title} size="sm" />
                <span className="flex-1 truncate text-sm text-(--color-text-primary)">{c.title}</span>
                {sentTo === c.id && <span className="text-xs text-(--color-primary)">Sent</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
