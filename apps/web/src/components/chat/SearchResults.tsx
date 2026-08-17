"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, EmptyState } from "@samva/ui";

interface SearchResponse {
  users: { userId: string; username: string; displayName: string; avatarUrl: string | null }[];
  conversations: { id: string; title: string; avatarUrl: string | null }[];
  messages: {
    id: string;
    conversationId: string;
    conversationTitle: string;
    senderName: string;
    content: string;
    createdAt: string;
  }[];
}

export function SearchResults({ query }: { query: string }) {
  const router = useRouter();
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  // A query change should flip the loading flag before the next paint —
  // adjusting state during render (React's documented pattern for this)
  // rather than a synchronous setState at the top of the effect below.
  const [lastQuery, setLastQuery] = React.useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setLoading(true);
  }

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: SearchResponse) => {
          if (!cancelled) {
            setResults(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function messageUser(username: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/chats/${data.conversationId}`);
      router.refresh();
    }
  }

  if (loading && !results) {
    return <div className="px-4 py-6 text-center text-sm text-(--color-text-tertiary)">Searching…</div>;
  }

  const hasAny =
    results && (results.users.length > 0 || results.conversations.length > 0 || results.messages.length > 0);

  if (results && !hasAny) {
    return <EmptyState title="No results" description={`Nothing matches "${query}".`} />;
  }

  return (
    <div className="flex flex-col gap-4 px-2 py-2">
      {results?.conversations && results.conversations.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">Chats</h3>
          {results.conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/chats/${c.id}`)}
              className="flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
            >
              <Avatar src={c.avatarUrl} name={c.title} size="sm" />
              <span className="truncate text-sm text-(--color-text-primary)">{c.title}</span>
            </button>
          ))}
        </section>
      )}

      {results?.users && results.users.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">People</h3>
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

      {results?.messages && results.messages.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-tertiary)">Messages</h3>
          {results.messages.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/chats/${m.conversationId}`)}
              className="flex w-full flex-col rounded-(--radius-md) px-3 py-2 text-left hover:bg-(--color-surface-raised)"
            >
              <span className="truncate text-sm font-medium text-(--color-text-primary)">{m.conversationTitle}</span>
              <span className="truncate text-xs text-(--color-text-secondary)">
                {m.senderName}: {m.content}
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
