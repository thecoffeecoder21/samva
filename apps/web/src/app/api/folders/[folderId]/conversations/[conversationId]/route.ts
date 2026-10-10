import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { conversationFolderMembers, conversationFolders, conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

type RouteContext = { params: Promise<{ folderId: string; conversationId: string }> };

async function requireOwnedFolderAndMembership(folderId: string, conversationId: string, userId: string) {
  const db = getDb();
  const [folder, membership] = await Promise.all([
    db.query.conversationFolders.findFirst({ where: and(eq(conversationFolders.id, folderId), eq(conversationFolders.userId, userId)) }),
    db.query.conversationMembers.findFirst({ where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)) }),
  ]);
  return Boolean(folder) && Boolean(membership);
}

export async function POST(_request: Request, context: RouteContext) {
  const { folderId, conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireOwnedFolderAndMembership(folderId, conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  await db.insert(conversationFolderMembers).values({ folderId, conversationId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId, conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireOwnedFolderAndMembership(folderId, conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  await db
    .delete(conversationFolderMembers)
    .where(and(eq(conversationFolderMembers.folderId, folderId), eq(conversationFolderMembers.conversationId, conversationId)));
  return NextResponse.json({ ok: true });
}
