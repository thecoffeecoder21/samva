"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@samva/ui";
import { NavRail } from "./NavRail";
import { MobileTabBar } from "./MobileTabBar";
import { ConversationList } from "./ConversationList";
import { useConversationsRealtime } from "@/lib/realtime/useConversationsRealtime";
import type { ConversationSummary } from "@/lib/view-models";

export function ChatShell({
  conversations: initialConversations,
  currentUserId,
  children,
}: {
  conversations: ConversationSummary[];
  currentUserId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const conversationMatch = /^\/chats\/([^/]+)/.exec(pathname ?? "");
  const conversationOpen = Boolean(conversationMatch);
  const activeConversationId = conversationMatch?.[1] ?? null;

  const conversations = useConversationsRealtime(initialConversations, currentUserId, activeConversationId);
  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex min-h-0 flex-1">
        <NavRail unreadCount={unreadCount} />
        <div
          className={cn(
            "w-full flex-none border-r border-(--color-border) md:w-[320px] lg:w-[360px]",
            conversationOpen && "hidden md:block",
          )}
        >
          <ConversationList conversations={conversations} />
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col", !conversationOpen && "hidden md:flex")}>
          {children}
        </div>
      </div>
      {!conversationOpen && <MobileTabBar unreadCount={unreadCount} />}
    </div>
  );
}
