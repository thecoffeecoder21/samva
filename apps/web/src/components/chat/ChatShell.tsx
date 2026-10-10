"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@samva/ui";
import { NavRail } from "./NavRail";
import { MobileTabBar } from "./MobileTabBar";
import { ConversationList } from "./ConversationList";
import { CommandPalette } from "./CommandPalette";
import { useConversationsRealtime } from "@/lib/realtime/useConversationsRealtime";
import type { ConversationFolder, ConversationSummary } from "@/lib/view-models";

export function ChatShell({
  conversations: initialConversations,
  folders,
  currentUserId,
  children,
}: {
  conversations: ConversationSummary[];
  folders: ConversationFolder[];
  currentUserId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const conversationMatch = /^\/chats\/([^/]+)/.exec(pathname ?? "");
  const conversationOpen = Boolean(conversationMatch);
  const activeConversationId = conversationMatch?.[1] ?? null;

  const conversations = useConversationsRealtime(initialConversations, currentUserId, activeConversationId);
  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex min-h-0 flex-1">
        <NavRail unreadCount={unreadCount} onOpenSearch={() => setPaletteOpen(true)} />
        <div
          className={cn(
            "w-full flex-none border-r border-(--color-border) md:w-[320px] lg:w-[360px]",
            conversationOpen && "hidden md:block",
          )}
        >
          <ConversationList conversations={conversations} initialFolders={folders} />
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col", !conversationOpen && "hidden md:flex")}>
          {children}
        </div>
      </div>
      {!conversationOpen && <MobileTabBar unreadCount={unreadCount} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} recentConversations={conversations} />
    </div>
  );
}
