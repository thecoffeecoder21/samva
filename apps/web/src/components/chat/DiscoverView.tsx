"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar, Button, EmptyState, Input } from "@samva/ui";
import type { ChannelSummary } from "@/lib/view-models";

export function DiscoverView({ initialChannels }: { initialChannels: ChannelSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [channels, setChannels] = React.useState(initialChannels);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      fetch(`/api/channels?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data) => setChannels(data.channels ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function toggleFollow(channel: ChannelSummary) {
    setPendingId(channel.id);
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, isFollowing: !c.isFollowing, memberCount: c.memberCount + (c.isFollowing ? -1 : 1) } : c)));
    try {
      const res = await fetch(`/api/channels/${channel.id}/follow`, { method: channel.isFollowing ? "DELETE" : "POST" });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? channel : c)));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-(--color-border) px-4 py-3">
        <h1 className="mb-3 text-lg font-semibold">Discover</h1>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public channels"
            className="pl-9"
            aria-label="Search public channels"
          />
        </div>
      </div>
      {channels.length === 0 ? (
        <EmptyState title="No channels found" description="Try a different search, or create your own from Communities." className="h-full" />
      ) : (
        <div className="flex flex-col gap-1 px-2 py-2">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 rounded-(--radius-md) px-2 py-2.5">
              {channel.isFollowing ? (
                <Link href={`/chats/${channel.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                  <Avatar src={channel.avatarUrl} name={channel.name} />
                  <ChannelText channel={channel} />
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={channel.avatarUrl} name={channel.name} />
                  <ChannelText channel={channel} />
                </div>
              )}
              <Button
                variant={channel.isFollowing ? "secondary" : "primary"}
                size="sm"
                disabled={pendingId === channel.id}
                onClick={() => toggleFollow(channel)}
              >
                {channel.isFollowing ? "Following" : "Follow"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelText({ channel }: { channel: ChannelSummary }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-(--color-text-primary)">{channel.name}</p>
      <p className="truncate text-xs text-(--color-text-secondary)">
        {channel.memberCount} follower{channel.memberCount === 1 ? "" : "s"}
        {channel.description ? ` · ${channel.description}` : ""}
      </p>
    </div>
  );
}
