"use client";

import * as React from "react";
import type { Message, RealtimeEvent } from "@samva/types";
import type { ConversationSummary } from "@/lib/view-models";

/**
 * Shell-level realtime subscription covering every conversation the user is
 * a member of (not just the one currently open) — feeds the conversation
 * list's live preview/unread state and the nav badge. Separate from
 * useConversationSocket (which only tracks the single open conversation);
 * the two connections are independent and each cheap enough on its own.
 */
export function useConversationsRealtime(
  initial: ConversationSummary[],
  currentUserId: string,
  activeConversationId: string | null,
) {
  const [conversations, setConversations] = React.useState(initial);
  const activeConversationIdRef = React.useRef(activeConversationId);
  const currentUserIdRef = React.useRef(currentUserId);
  const socketRef = React.useRef<WebSocket | null>(null);
  const subscribedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    currentUserIdRef.current = currentUserId;
  });

  // Re-derive from a changed server-provided list (e.g. a new chat was
  // created and the layout re-fetched) during render, per React's
  // documented pattern for resetting state from a prop change — not in an
  // effect, since this needs to apply before paint.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setConversations(initial);
  }

  // Opening a conversation optimistically clears its unread count immediately
  // rather than waiting on the read-receipt round trip; same render-time
  // pattern, keyed on the id actually changing.
  const [lastActiveId, setLastActiveId] = React.useState(activeConversationId);
  if (activeConversationId !== lastActiveId) {
    setLastActiveId(activeConversationId);
    if (activeConversationId) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c)),
      );
    }
  }

  // Subscribing any newly-added conversation on an already-open socket is a
  // genuine external-system side effect, so it stays in an effect.
  React.useEffect(() => {
    const socket = socketRef.current;
    for (const c of initial) {
      if (subscribedRef.current.has(c.id)) continue;
      subscribedRef.current.add(c.id);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "subscribe", conversationId: c.id }));
      }
    }
  }, [initial]);

  React.useEffect(() => {
    let reconnectDelay = 1000;
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function handleEvent(event: RealtimeEvent) {
      if (event.type === "message.created") {
        applyIncomingMessage(event.payload);
      } else if (event.type === "read.receipt" && event.payload.userId === currentUserIdRef.current) {
        setConversations((prev) =>
          prev.map((c) => (c.id === event.payload.conversationId ? { ...c, unreadCount: 0 } : c)),
        );
      } else if (event.type === "presence.updated") {
        const { userId, status } = event.payload;
        setConversations((prev) =>
          prev.map((c) => (c.peerUserId === userId ? { ...c, isOnline: status === "online" } : c)),
        );
      } else if (event.type === "conversation.updated") {
        const { conversationId, name, avatarUrl } = event.payload;
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: name ?? c.title, avatarUrl } : c)),
        );
      } else if (event.type === "conversation.muted_updated" && event.payload.userId === currentUserIdRef.current) {
        const { conversationId, mutedUntil } = event.payload;
        const isMuted = Boolean(mutedUntil && new Date(mutedUntil) > new Date());
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, isMuted } : c)));
      } else if (event.type === "conversation.member_removed" && event.payload.userId === currentUserIdRef.current) {
        setConversations((prev) => prev.filter((c) => c.id !== event.payload.conversationId));
      } else if (event.type === "conversation.list_state_updated" && event.payload.userId === currentUserIdRef.current) {
        const { conversationId, isPinned, isArchived } = event.payload;
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, isPinned, isArchived } : c)));
      }
    }

    function applyIncomingMessage(message: Message) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== message.conversationId) return c;
          const isOwn = message.senderId === currentUserIdRef.current;
          const isActive = activeConversationIdRef.current === c.id;
          return {
            ...c,
            lastMessagePreview: message.content ?? "Attachment",
            lastMessageAt: message.createdAt,
            unreadCount: isOwn || isActive ? c.unreadCount : c.unreadCount + 1,
          };
        }),
      );
    }

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectDelay = 1000;
        for (const id of subscribedRef.current) {
          socket.send(JSON.stringify({ type: "subscribe", conversationId: id }));
        }
      });

      socket.addEventListener("message", (event) => {
        try {
          handleEvent(JSON.parse(event.data) as RealtimeEvent);
        } catch {
          return;
        }
      });

      socket.addEventListener("close", () => {
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      });
    }

    connect();

    return () => {
      closedByCleanup = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return conversations;
}
