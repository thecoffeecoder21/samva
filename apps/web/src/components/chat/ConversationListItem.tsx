import Link from "next/link";
import { Avatar, Badge, cn } from "@samva/ui";
import { BellOff, Pin } from "lucide-react";
import type { ConversationSummary } from "@/lib/view-models";

export function ConversationListItem({
  conversation,
  active,
}: {
  conversation: ConversationSummary;
  active: boolean;
}) {
  const c = conversation;
  return (
    <Link
      href={`/chats/${c.id}`}
      className={cn(
        "flex items-center gap-3 rounded-(--radius-md) px-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-(--color-surface-raised)",
        active && "bg-(--color-surface-raised)",
      )}
    >
      <Avatar src={c.avatarUrl} name={c.title} online={c.isOnline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-(--color-text-primary)">{c.title}</span>
          {c.lastMessageAt && (
            <span className="shrink-0 text-[11px] text-(--color-text-tertiary)" suppressHydrationWarning>
              {formatTimestamp(c.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-(--color-text-secondary)">
            {c.lastMessagePreview ?? "No messages yet"}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {c.isPinned && <Pin size={12} className="text-(--color-text-tertiary)" />}
            {c.isMuted && <BellOff size={12} className="text-(--color-text-tertiary)" />}
            {c.unreadCount > 0 && <Badge size="sm">{c.unreadCount > 99 ? "99+" : c.unreadCount}</Badge>}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
