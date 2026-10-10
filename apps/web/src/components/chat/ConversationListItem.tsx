"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, Badge, IconButton, cn } from "@samva/ui";
import { ArchiveRestore, Archive as ArchiveIcon, BellOff, Check, FolderPlus, MoreVertical, Pin, PinOff } from "lucide-react";
import type { ConversationFolder, ConversationSummary } from "@/lib/view-models";

export function ConversationListItem({
  conversation,
  active,
  folders,
  onTogglePin,
  onToggleArchive,
  onToggleFolder,
}: {
  conversation: ConversationSummary;
  active: boolean;
  folders: ConversationFolder[];
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onToggleFolder: (folderId: string) => void;
}) {
  const c = conversation;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [folderSubmenuOpen, setFolderSubmenuOpen] = React.useState(false);

  return (
    <div className={cn("group relative", menuOpen && "z-10")}>
      <Link
        href={`/chats/${c.id}`}
        className={cn(
          "flex items-center gap-3 rounded-(--radius-md) px-3 py-2.5 pr-9 transition-colors duration-(--duration-fast) hover:bg-(--color-surface-raised)",
          active && "bg-(--color-surface-raised)",
        )}
      >
        <Avatar src={c.avatarUrl} name={c.title} online={c.isOnline} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-(--color-text-primary)">{c.title}</span>
            {c.lastMessageAt && (
              <span className="shrink-0 text-[11px] text-(--color-text-tertiary)" suppressHydrationWarning>
                {formatTimestamp(c.lastMessageAt)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-(--color-text-secondary)">
              {c.lastMessagePreview ?? "No messages yet"}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {c.isPinned && <Pin size={12} className="text-(--color-text-tertiary)" />}
              {c.isMuted && <BellOff size={12} className="text-(--color-text-tertiary)" />}
              {c.unreadCount > 0 && <Badge size="sm">{c.unreadCount > 99 ? "99+" : c.unreadCount}</Badge>}
            </span>
          </div>
        </div>
      </Link>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
        <IconButton
          aria-label={`Options for ${c.title}`}
          aria-expanded={menuOpen}
          size="sm"
          onClick={() => {
            setMenuOpen((v) => !v);
            setFolderSubmenuOpen(false);
          }}
        >
          <MoreVertical size={16} />
        </IconButton>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 flex w-48 flex-col rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-md)">
            <button
              className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
              onClick={() => {
                onTogglePin();
                setMenuOpen(false);
              }}
            >
              {c.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              {c.isPinned ? "Unpin" : "Pin to top"}
            </button>
            <button
              className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
              onClick={() => {
                onToggleArchive();
                setMenuOpen(false);
              }}
            >
              {c.isArchived ? <ArchiveRestore size={14} /> : <ArchiveIcon size={14} />}
              {c.isArchived ? "Unarchive" : "Archive"}
            </button>
            {folders.length > 0 && (
              <div className="relative">
                <button
                  className="flex w-full items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                  onClick={() => setFolderSubmenuOpen((v) => !v)}
                >
                  <FolderPlus size={14} /> Add to folder
                </button>
                {folderSubmenuOpen && (
                  <div className="mt-1 flex flex-col gap-0.5 border-t border-(--color-border) pt-1">
                    {folders.map((folder) => {
                      const inFolder = folder.conversationIds.includes(c.id);
                      return (
                        <button
                          key={folder.id}
                          className="flex items-center justify-between rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                          onClick={() => {
                            onToggleFolder(folder.id);
                            setMenuOpen(false);
                            setFolderSubmenuOpen(false);
                          }}
                        >
                          <span className="truncate">{folder.name}</span>
                          {inFolder && <Check size={12} className="text-(--color-primary)" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
