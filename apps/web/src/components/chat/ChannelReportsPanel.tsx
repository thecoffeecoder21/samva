"use client";

import * as React from "react";
import { Flag, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@samva/ui";

interface ReportedMessage {
  messageId: string;
  message: { content: string | null; type: string };
  senderName: string;
  reportCount: number;
  reasons: string[];
  firstReportedAt: string;
}

export function ChannelReportsPanel({ conversationId }: { conversationId: string }) {
  const [reports, setReports] = React.useState<ReportedMessage[] | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch(`/api/channels/${conversationId}/reports`)
      .then((res) => res.json())
      .then((data: { reports: ReportedMessage[] }) => setReports(data.reports));
  }, [conversationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function act(messageId: string, action: "remove" | "dismiss") {
    setPendingId(messageId);
    setReports((prev) => prev?.filter((r) => r.messageId !== messageId) ?? null);
    await fetch(`/api/channels/${conversationId}/reports/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    setPendingId(null);
  }

  if (reports === null) return <p className="py-4 text-center text-sm text-(--color-text-tertiary)">Loading…</p>;
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
        <Flag size={24} className="text-(--color-text-tertiary)" strokeWidth={1.5} />
        <p className="text-sm text-(--color-text-secondary)">No open reports.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {reports.map((report) => (
        <div key={report.messageId} className="flex flex-col gap-1.5 rounded-(--radius-md) border border-(--color-border) p-2.5">
          <div className="flex items-center justify-between text-xs text-(--color-text-tertiary)">
            <span>
              {report.reportCount} report{report.reportCount === 1 ? "" : "s"} · from {report.senderName}
            </span>
          </div>
          <p className="truncate text-sm text-(--color-text-primary)">{report.message.content ?? "Attachment"}</p>
          <p className="truncate text-xs text-(--color-text-tertiary)">Reason: {report.reasons[0]}</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="secondary" disabled={pendingId === report.messageId} onClick={() => act(report.messageId, "dismiss")}>
              <ShieldOff size={14} /> Dismiss
            </Button>
            <Button size="sm" variant="danger" disabled={pendingId === report.messageId} onClick={() => act(report.messageId, "remove")}>
              <Trash2 size={14} /> Remove message
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
