import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { conversationMembers, getDb, profiles } from "@samva/db";
import type { RealtimeEvent } from "@samva/types";
import { getOrCreateUser } from "@/lib/auth";
import { publishEvent, subscribeToConversation } from "@/lib/realtime/bus";
import { markConnected, markDisconnected } from "@/lib/presence";

type ClientMessage =
  | { type: "subscribe"; conversationId: string }
  | { type: "unsubscribe"; conversationId: string }
  | { type: "typing"; conversationId: string; isTyping: boolean };

async function isMember(conversationId: string, userId: string) {
  const db = getDb();
  const row = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
  });
  return Boolean(row);
}

async function getUserConversationIds(userId: string) {
  const db = getDb();
  const rows = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));
  return rows.map((r) => r.conversationId);
}

async function broadcastPresence(userId: string, status: "online" | "offline", lastSeenAt: string | null) {
  const conversationIds = await getUserConversationIds(userId);
  await Promise.all(
    conversationIds.map((conversationId) =>
      publishEvent(conversationId, { type: "presence.updated", payload: { userId, status, lastSeenAt } }),
    ),
  );
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  return experimental_upgradeWebSocket(async (ws) => {
    const unsubscribes = new Map<string, () => void>();

    const becameOnline = await markConnected(user.id);
    if (becameOnline) {
      broadcastPresence(user.id, "online", null).catch(() => {});
    }

    ws.on("message", async (data: WebSocketData) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }

      if (message.type === "subscribe") {
        if (unsubscribes.has(message.conversationId)) return;
        if (!(await isMember(message.conversationId, user.id))) return;
        const unsubscribe = await subscribeToConversation(message.conversationId, (event: RealtimeEvent) => {
          ws.send(JSON.stringify(event));
        });
        unsubscribes.set(message.conversationId, unsubscribe);
        return;
      }

      if (message.type === "unsubscribe") {
        unsubscribes.get(message.conversationId)?.();
        unsubscribes.delete(message.conversationId);
        return;
      }

      if (message.type === "typing") {
        if (!unsubscribes.has(message.conversationId)) return;
        await publishEvent(message.conversationId, {
          type: message.isTyping ? "typing.started" : "typing.stopped",
          payload: { conversationId: message.conversationId, userId: user.id, isTyping: message.isTyping },
        });
      }
    });

    ws.on("close", async () => {
      for (const unsubscribe of unsubscribes.values()) unsubscribe();
      unsubscribes.clear();

      const becameOffline = await markDisconnected(user.id);
      if (becameOffline) {
        const db = getDb();
        const lastSeenAt = new Date();
        await db.update(profiles).set({ lastSeenAt }).where(eq(profiles.userId, user.id));
        await broadcastPresence(user.id, "offline", lastSeenAt.toISOString());
      }
    });
  });
}
