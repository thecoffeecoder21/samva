"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, Plus, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, IconButton } from "@samva/ui";
import type { ChannelSummary } from "@/lib/view-models";
import { CreateChannelDialog } from "./CreateChannelDialog";

export function CommunitiesView({ channels }: { channels: ChannelSummary[] }) {
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
        <h1 className="flex-1 text-lg font-semibold">Communities</h1>
        <IconButton aria-label="Create a channel" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={18} strokeWidth={1.75} />
        </IconButton>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon={<Users size={40} strokeWidth={1.25} />}
          title="No channels yet"
          description="Create your own broadcast channel, or browse public ones in Discover."
          className="h-full"
          action={
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)}>Create a channel</Button>
              <Link href="/discover">
                <Button variant="secondary">
                  <Compass size={16} /> Discover
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-1 px-2 py-2">
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/chats/${channel.id}`}
              className="flex items-center gap-3 rounded-(--radius-md) px-2 py-2.5 hover:bg-(--color-surface-raised)"
            >
              <Avatar src={channel.avatarUrl} name={channel.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--color-text-primary)">{channel.name}</p>
                <p className="truncate text-xs text-(--color-text-secondary)">
                  {channel.memberCount} follower{channel.memberCount === 1 ? "" : "s"}
                  {channel.description ? ` · ${channel.description}` : ""}
                </p>
              </div>
              {(channel.myRole === "owner" || channel.myRole === "admin") && (
                <Badge size="sm" className="capitalize">
                  {channel.myRole}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}

      <CreateChannelDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
