import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationFolders, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

type RouteContext = { params: Promise<{ folderId: string }> };

const bodySchema = z.object({ name: z.string().trim().min(1).max(40) });

export async function PATCH(request: Request, context: RouteContext) {
  const { folderId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .update(conversationFolders)
    .set({ name: parsed.data.name })
    .where(and(eq(conversationFolders.id, folderId), eq(conversationFolders.userId, user.id)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, name: row.name });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  await db.delete(conversationFolders).where(and(eq(conversationFolders.id, folderId), eq(conversationFolders.userId, user.id)));

  return NextResponse.json({ ok: true });
}
