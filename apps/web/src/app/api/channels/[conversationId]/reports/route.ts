import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { conversationMembers, getDb, messageReports, messages, profiles } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";
import { toMessageDto } from "@/lib/messages";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function requireAdmin(conversationId: string, userId: string) {
  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
  });
  return membership && (membership.role === "owner" || membership.role === "admin") ? membership : null;
}

export interface ReportedMessageGroup {
  messageId: string;
  message: ReturnType<typeof toMessageDto>;
  senderName: string;
  reportCount: number;
  reasons: string[];
  firstReportedAt: string;
}

export async function GET(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(conversationId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const openReports = await db
    .select()
    .from(messageReports)
    .where(and(eq(messageReports.conversationId, conversationId), eq(messageReports.status, "open")))
    .orderBy(asc(messageReports.createdAt));
  if (openReports.length === 0) return NextResponse.json({ reports: [] satisfies ReportedMessageGroup[] });

  const messageIds = [...new Set(openReports.map((r) => r.messageId))];
  const messageRows = await db.select().from(messages).where(inArray(messages.id, messageIds));
  const messagesById = new Map(messageRows.map((m) => [m.id, m]));
  const senderIds = [...new Set(messageRows.map((m) => m.senderId))];
  const senderProfiles = senderIds.length
    ? await db.select({ userId: profiles.userId, displayName: profiles.displayName }).from(profiles).where(inArray(profiles.userId, senderIds))
    : [];
  const senderNameById = new Map(senderProfiles.map((p) => [p.userId, p.displayName]));

  const grouped = new Map<string, { reasons: string[]; firstReportedAt: Date }>();
  for (const report of openReports) {
    const entry = grouped.get(report.messageId);
    if (entry) entry.reasons.push(report.reason);
    else grouped.set(report.messageId, { reasons: [report.reason], firstReportedAt: report.createdAt });
  }

  const result: ReportedMessageGroup[] = [...grouped.entries()]
    .map(([messageId, { reasons, firstReportedAt }]) => {
      const row = messagesById.get(messageId);
      if (!row) return null;
      return {
        messageId,
        message: toMessageDto(row, [], []),
        senderName: senderNameById.get(row.senderId) ?? "Unknown",
        reportCount: reasons.length,
        reasons,
        firstReportedAt: firstReportedAt.toISOString(),
      };
    })
    .filter((r): r is ReportedMessageGroup => r !== null);

  return NextResponse.json({ reports: result });
}
