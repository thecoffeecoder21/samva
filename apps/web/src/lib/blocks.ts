import "server-only";
import { and, eq, or } from "drizzle-orm";
import { blocks, getDb } from "@samva/db";

/** True if either user has blocked the other — a mutual restriction, not just one-directional. */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.blocks.findFirst({
    where: or(
      and(eq(blocks.blockerId, userA), eq(blocks.blockedId, userB)),
      and(eq(blocks.blockerId, userB), eq(blocks.blockedId, userA)),
    ),
  });
  return Boolean(row);
}

export async function didIBlockThem(blockerId: string, blockedId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.blocks.findFirst({
    where: and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)),
  });
  return Boolean(row);
}
