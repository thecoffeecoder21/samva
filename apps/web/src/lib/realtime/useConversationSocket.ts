"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeEvent } from "@samva/types";

/**
 * Opens one WebSocket per mounted conversation, subscribes to its channel,
 * and reconnects with exponential backoff on drop (section 33/34 — the
 * client must survive flaky mobile networks, not just the happy path).
 */
export function useConversationSocket(conversationId: string, onEvent: (event: RealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectDelay = 1000;
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectDelay = 1000;
        socket.send(JSON.stringify({ type: "subscribe", conversationId }));
      });

      socket.addEventListener("message", (event) => {
        try {
          onEventRef.current(JSON.parse(event.data) as RealtimeEvent);
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
  }, [conversationId]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "typing", conversationId, isTyping }));
      }
    },
    [conversationId],
  );

  return { sendTyping };
}
