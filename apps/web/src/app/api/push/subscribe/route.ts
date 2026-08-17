import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, pushSubscriptions } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const db = getDb();
  const { endpoint, keys } = parsed.data;

  const existing = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, endpoint) });
  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ userId: user.id, p256dh: keys.p256dh, auth: keys.auth })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptions).values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth });
  }

  return NextResponse.json({ ok: true });
}
