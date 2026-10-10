"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Archive, Plus, Search, SquarePen, X } from "lucide-react";
import { Button, EmptyState, IconButton, Input, cn } from "@samva/ui";
import type { ConversationFolder, ConversationSummary } from "@/lib/view-models";
import { useT } from "@/lib/i18n/I18nProvider";
import { ConversationListItem } from "./ConversationListItem";
import { NewChatDialog } from "./NewChatDialog";
import { SearchResults } from "./SearchResults";

export function ConversationList({
  conversations,
  initialFolders,
}: {
  conversations: ConversationSummary[];
  initialFolders: ConversationFolder[];
}) {
  const [query, setQuery] = React.useState("");
  const [newChatOpen, setNewChatOpen] = React.useState(false);
  const [folders, setFolders] = React.useState(initialFolders);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const params = useParams<{ conversationId?: string }>();
  const trimmedQuery = query.trim();
  const t = useT();

  async function togglePin(conversation: ConversationSummary) {
    await fetch(`/api/conversations/${conversation.id}/list-state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !conversation.isPinned }),
    }).catch(() => {});
  }

  async function toggleArchive(conversation: ConversationSummary) {
    await fetch(`/api/conversations/${conversation.id}/list-state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !conversation.isArchived }),
    }).catch(() => {});
  }

  async function toggleFolder(conversationId: string, folderId: string) {
    const folder = folders.find((f) => f.id === folderId);
    const inFolder = folder?.conversationIds.includes(conversationId) ?? false;
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, conversationIds: inFolder ? f.conversationIds.filter((id) => id !== conversationId) : [...f.conversationIds, conversationId] }
          : f,
      ),
    );
    await fetch(`/api/folders/${folderId}/conversations/${conversationId}`, { method: inFolder ? "DELETE" : "POST" }).catch(() => {});
  }

  async function createFolder(name: string) {
    setCreatingFolder(false);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (res?.ok) {
      const { folder } = (await res.json()) as { folder: ConversationFolder };
      setFolders((prev) => [...prev, folder]);
    }
  }

  const archivedCount = conversations.filter((c) => c.isArchived).length;
  const visible = conversations.filter((c) => {
    if (c.isArchived !== showArchived) return false;
    if (selectedFolderId) {
      const folder = folders.find((f) => f.id === selectedFolderId);
      if (!folder?.conversationIds.includes(c.id)) return false;
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
        <h1 className="flex-1 text-lg font-semibold">{showArchived ? "Archived" : t("chatList.title")}</h1>
        {showArchived ? (
          <Button variant="secondary" size="sm" onClick={() => setShowArchived(false)}>
            Done
          </Button>
        ) : (
          <IconButton aria-label={t("chatList.startNewChat")} size="sm" onClick={() => setNewChatOpen(true)}>
            <SquarePen size={18} strokeWidth={1.75} />
          </IconButton>
        )}
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
      {!showArchived && !trimmedQuery && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-(--color-border) px-3 py-2">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              "shrink-0 rounded-(--radius-full) px-2.5 py-1 text-xs font-medium",
              selectedFolderId === null ? "bg-(--color-primary) text-(--color-primary-fg)" : "bg-(--color-surface-raised) text-(--color-text-secondary)",
            )}
          >
            All
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={cn(
                "shrink-0 rounded-(--radius-full) px-2.5 py-1 text-xs font-medium",
                selectedFolderId === folder.id ? "bg-(--color-primary) text-(--color-primary-fg)" : "bg-(--color-surface-raised) text-(--color-text-secondary)",
              )}
            >
              {folder.name}
            </button>
          ))}
          <IconButton aria-label="Create a folder" size="sm" onClick={() => setCreatingFolder(true)}>
            <Plus size={14} />
          </IconButton>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {trimmedQuery ? (
          <SearchResults query={trimmedQuery} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={showArchived ? "No archived chats" : t("chatList.emptyTitle")}
            description={showArchived ? "Chats you archive will show up here." : t("chatList.emptyDescription")}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {visible.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={params?.conversationId === c.id}
                folders={folders}
                onTogglePin={() => togglePin(c)}
                onToggleArchive={() => toggleArchive(c)}
                onToggleFolder={(folderId) => toggleFolder(c.id, folderId)}
              />
            ))}
          </div>
        )}
      </div>
      {!showArchived && (
        <button
          onClick={() => setShowArchived(true)}
          className="flex items-center gap-2 border-t border-(--color-border) px-4 py-2.5 text-left text-xs text-(--color-text-secondary) hover:bg-(--color-surface-raised)"
        >
          <Archive size={14} />
          Archived chats {archivedCount > 0 && `(${archivedCount})`}
        </button>
      )}
      <NewChatDialog open={newChatOpen} onClose={() => setNewChatOpen(false)} />
      {creatingFolder && <CreateFolderDialog onClose={() => setCreatingFolder(false)} onCreate={createFolder} />}
    </div>
  );
}

function CreateFolderDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = React.useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex w-full max-w-xs flex-col gap-3 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-4 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New folder</h2>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          aria-label="Folder name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onCreate(name.trim());
          }}
        />
        <Button size="sm" disabled={!name.trim()} onClick={() => onCreate(name.trim())} className="self-end">
          Create
        </Button>
      </div>
    </div>
  );
}
