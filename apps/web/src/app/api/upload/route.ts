import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, getDb } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

const clientPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  kind: z.enum(["image", "video", "audio", "document"]),
});

const CONTENT_TYPES: Record<z.infer<typeof clientPayloadSchema>["kind"], string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-m4a"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ],
};

const MAX_SIZE_BYTES: Record<z.infer<typeof clientPayloadSchema>["kind"], number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        const parsed = clientPayloadSchema.safeParse(JSON.parse(clientPayloadRaw ?? "{}"));
        if (!parsed.success) throw new Error("Invalid upload request");

        const db = getDb();
        const membership = await db.query.conversationMembers.findFirst({
          where: and(
            eq(conversationMembers.conversationId, parsed.data.conversationId),
            eq(conversationMembers.userId, user.id),
          ),
        });
        if (!membership) throw new Error("Not a member of this conversation");

        return {
          allowedContentTypes: CONTENT_TYPES[parsed.data.kind],
          maximumSizeInBytes: MAX_SIZE_BYTES[parsed.data.kind],
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
