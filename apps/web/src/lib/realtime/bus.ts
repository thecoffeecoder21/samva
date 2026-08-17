import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "@neondatabase/serverless";
import type { RealtimeEvent } from "@samva/types";

const CHANNEL = "samva_events";
// Postgres NOTIFY payloads are capped at ~8000 bytes; leave headroom for the
// JSON wrapper around a message's content (itself capped at 8000 chars by
// the send-message schema). Rather than silently truncating message bodies,
// an oversized event is dropped from the realtime push — the message is
// still persisted and appears on the recipient's next fetch/reload.
const MAX_NOTIFY_PAYLOAD_BYTES = 7800;

// Neon's default autosuspend window is a few minutes of inactivity; a
// keepalive comfortably inside that window stops the dedicated LISTEN
// connection from ever going idle long enough to be reclaimed.
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

// Local fan-out is correct within a single Function instance / the dev
// server. A WebSocket connection is pinned to one instance and Fluid Compute
// may route different connections to different instances, so cross-instance
// delivery needs a shared broker. Upstash's Redis was tried first (per the
// spec's section 38) but its pub/sub does not actually deliver messages in
// this environment — publish and psubscribe both report success with
// nothing ever received. Postgres LISTEN/NOTIFY over Neon's WebSocket
// `Client` (already provisioned, no extra infra) works instead — but only
// over the *unpooled* connection string. Neon's default DATABASE_URL is
// routed through a PgBouncer-style pooler, which breaks LISTEN/NOTIFY:
// pooled connections can be reassigned to a different backend session
// between queries, so a listener never reliably stays attached to the
// backend a NOTIFY is broadcast from. DATABASE_URL_UNPOOLED holds one
// dedicated session for the lifetime of this Client.
const local = new EventEmitter();
local.setMaxListeners(0);

let listenClient: Client | null = null;
let connecting: Promise<void> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

function teardown() {
  listenClient = null;
  connecting = null;
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
  // A subscriber may be sitting idle waiting on this exact connection with no
  // reason of its own to call back in — reconnect proactively instead of
  // waiting for the next publish/subscribe to notice the client is gone.
  ensureListening().catch(() => {});
}

async function ensureListening() {
  if (listenClient) return;
  if (connecting) return connecting;

  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) return;

  connecting = (async () => {
    const client = new Client(url);
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const { conversationId, event } = JSON.parse(msg.payload) as {
          conversationId: string;
          event: RealtimeEvent;
        };
        local.emit(conversationId, event);
      } catch {
        return;
      }
    });
    client.on("error", teardown);
    client.on("end", teardown);

    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listenClient = client;
    keepaliveTimer = setInterval(() => {
      client.query("SELECT 1").catch(() => teardown());
    }, KEEPALIVE_INTERVAL_MS);
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function publishEvent(conversationId: string, event: RealtimeEvent) {
  await ensureListening();
  local.emit(conversationId, event);

  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url || !listenClient) return;

  const payload = JSON.stringify({ conversationId, event });
  if (Buffer.byteLength(payload, "utf8") > MAX_NOTIFY_PAYLOAD_BYTES) return;

  await listenClient.query("SELECT pg_notify($1, $2)", [CHANNEL, payload]).catch(() => {});
}

export async function subscribeToConversation(conversationId: string, handler: (event: RealtimeEvent) => void) {
  await ensureListening();
  local.on(conversationId, handler);
  return () => {
    local.off(conversationId, handler);
  };
}
