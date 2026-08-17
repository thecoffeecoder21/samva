"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Search, SquarePen } from "lucide-react";
import { EmptyState, IconButton, Input } from "@samva/ui";
import type { ConversationSummary } from "@/lib/view-models";
import { useT } from "@/lib/i18n/I18nProvider";
import { ConversationListItem } from "./ConversationListItem";
import { NewChatDialog } from "./NewChatDialog";
import { SearchResults } from "./SearchResults";

export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const [query, setQuery] = React.useState("");
  const [newChatOpen, setNewChatOpen] = React.useState(false);
  const params = useParams<{ conversationId?: string }>();
  const trimmedQuery = query.trim();
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
        <h1 className="flex-1 text-lg font-semibold">{t("chatList.title")}</h1>
        <IconButton aria-label={t("chatList.startNewChat")} size="sm" onClick={() => setNewChatOpen(true)}>
          <SquarePen size={18} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="border-b border-(--color-border) px-3 py-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chatList.searchPlaceholder")}
            className="pl-9"
            aria-label={t("chatList.searchPlaceholder")}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {trimmedQuery ? (
          <SearchResults query={trimmedQuery} />
        ) : conversations.length === 0 ? (
          <EmptyState
            title={t("chatList.emptyTitle")}
            description={t("chatList.emptyDescription")}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} active={params?.conversationId === c.id} />
            ))}
          </div>
        )}
      </div>
      <NewChatDialog open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </div>
  );
}
