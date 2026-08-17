import { NextResponse } from "next/server";
import { z } from "zod";
import { conversationMembers, conversations, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { getChannelDirectory } from "@/lib/queries";

export async function GET(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const channels = await getChannelDirectory(user.id, searchParams.get("q") ?? undefined);
  return NextResponse.json({ channels });
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullable().optional(),
  isPublic: z.boolean().default(true),
});

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  const [conversation] = await db
    .insert(conversations)
    .values({
      type: "channel",
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isPublic: parsed.data.isPublic,
      createdBy: user.id,
    })
    .returning();
  if (!conversation) return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });

  await db.insert(conversationMembers).values({ conversationId: conversation.id, userId: user.id, role: "owner" });

  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}
