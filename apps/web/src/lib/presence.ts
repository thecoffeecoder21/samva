import "server-only";
import { Redis } from "@upstash/redis";

// Reuses the Upstash instance already provisioned for this project. Its
// pub/sub doesn't actually deliver (see the realtime bus's notes on why
// LISTEN/NOTIFY is used instead for that) but plain GET/INCR/DECR over the
// REST API work fine — this is a simple connection counter, not streaming.
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function key(userId: string) {
  return `presence:${userId}`;
}

/** Returns true only on the 0→1 transition (this is the user's first open connection). */
export async function markConnected(userId: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;
  const count = await client.incr(key(userId));
  return count === 1;
}

/** Returns true only on the transition to zero (this was the user's last open connection). */
export async function markDisconnected(userId: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;
  const count = await client.decr(key(userId));
  if (count <= 0) {
    await client.del(key(userId));
    return true;
  }
  return false;
}

export async function getOnlineStatuses(userIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map(userIds.map((id) => [id, false]));
  const client = getRedis();
  if (!client || userIds.length === 0) return result;

  const counts = await client.mget<number[]>(...userIds.map(key));
  userIds.forEach((id, i) => result.set(id, Boolean(counts[i] && counts[i]! > 0)));
  return result;
}
