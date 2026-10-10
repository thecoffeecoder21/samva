import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationFolderMembers, conversationFolders, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import type { ConversationFolder } from "@/lib/view-models";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const folderRows = await db
    .select()
    .from(conversationFolders)
    .where(eq(conversationFolders.userId, user.id))
    .orderBy(asc(conversationFolders.position), asc(conversationFolders.createdAt));

  if (folderRows.length === 0) return NextResponse.json({ folders: [] satisfies ConversationFolder[] });

  const memberRows = await db.select().from(conversationFolderMembers);
  const conversationIdsByFolder = new Map<string, string[]>();
  for (const row of memberRows) {
    const list = conversationIdsByFolder.get(row.folderId);
    if (list) list.push(row.conversationId);
    else conversationIdsByFolder.set(row.folderId, [row.conversationId]);
  }

  const folders: ConversationFolder[] = folderRows.map((f) => ({
    id: f.id,
    name: f.name,
    position: f.position,
    conversationIds: conversationIdsByFolder.get(f.id) ?? [],
  }));
  return NextResponse.json({ folders });
}

const bodySchema = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const existing = await db
    .select({ id: conversationFolders.id })
    .from(conversationFolders)
    .where(eq(conversationFolders.userId, user.id));

  const [folder] = await db
    .insert(conversationFolders)
    .values({ userId: user.id, name: parsed.data.name, position: existing.length })
    .returning();
  if (!folder) return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });

  const dto: ConversationFolder = { id: folder.id, name: folder.name, position: folder.position, conversationIds: [] };
  return NextResponse.json({ folder: dto }, { status: 201 });
}
