"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@samva/ui";
import type { ConversationSummary } from "@/lib/view-models";

interface SearchResponse {
  users: { userId: string; username: string; displayName: string; avatarUrl: string | null }[];
  conversations: { id: string; title: string; avatarUrl: string | null }[];
  messages: {
    id: string;
    conversationId: string;
    conversationTitle: string;
    senderName: string;
    content: string;
  }[];
}

export function CommandPalette({
  open,
  onClose,
  recentConversations,
}: {
  open: boolean;
  onClose: () => void;
  recentConversations: ConversationSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setResults(null);
    }
  }

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    if (!open || !query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: SearchResponse) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  function go(conversationId: string) {
    router.push(`/chats/${conversationId}`);
    onClose();
  }

  async function messageUser(username: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok) go(data.conversationId);
  }

  const showRecents = !query.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="flex max-h-[60vh] w-full max-w-lg flex-col overflow-hidden rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-(--color-border) px-3 py-2.5">
          <Search size={16} className="shrink-0 text-(--color-text-tertiary)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats, people, messages…"
            className="w-full bg-transparent text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
          />
          <kbd className="shrink-0 rounded-(--radius-sm) border border-(--color-border) px-1.5 py-0.5 text-[10px] text-(--color-text-tertiary)">
            Esc
          </kbd>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {showRecents ? (
            <>
              <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">
                Recent chats
              </h3>
              {recentConversations.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(c.id)}
                  className="flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
                >
                  <Avatar src={c.avatarUrl} name={c.title} size="sm" />
                  <span className="truncate text-sm text-(--color-text-primary)">{c.title}</span>
                </button>
              ))}
            </>
          ) : !results ? (
            <p className="px-3 py-6 text-center text-sm text-(--color-text-tertiary)">Searching…</p>
          ) : (
            <>
              {results.conversations.length === 0 && results.users.length === 0 && results.messages.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-(--color-text-tertiary)">
                  Nothing matches &ldquo;{query}&rdquo;.
                </p>
              )}
              {results.conversations.length > 0 && (
                <section className="mb-2">
                  <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">
                    Chats
                  </h3>
                  {results.conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(c.id)}
                      className="flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
                    >
                      <Avatar src={c.avatarUrl} name={c.title} size="sm" />
                      <span className="truncate text-sm text-(--color-text-primary)">{c.title}</span>
                    </button>
                  ))}
                </section>
              )}
              {results.users.length > 0 && (
                <section className="mb-2">
                  <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">
                    People
                  </h3>
                  {results.users.map((u) => (
                    <button
                      key={u.userId}
                      onClick={() => messageUser(u.username)}
                      className="flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
                    >
                      <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-(--color-text-primary)">{u.displayName}</p>
                        <p className="truncate text-xs text-(--color-text-tertiary)">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </section>
              )}
              {results.messages.length > 0 && (
                <section>
                  <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">
                    Messages
                  </h3>
                  {results.messages.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => go(m.conversationId)}
                      className="flex w-full flex-col rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
                    >
                      <span className="truncate text-sm font-medium text-(--color-text-primary)">
                        {m.conversationTitle}
                      </span>
                      <span className="truncate text-xs text-(--color-text-secondary)">
                        {m.senderName}: {m.content}
                      </span>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
