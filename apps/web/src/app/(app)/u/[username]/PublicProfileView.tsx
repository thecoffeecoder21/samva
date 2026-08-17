"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Avatar, Button } from "@samva/ui";
import type { PublicProfile } from "@/lib/queries";

export function PublicProfileView({ profile, canMessage }: { profile: PublicProfile; canMessage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function startConversation() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/chats/${data.conversationId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-16">
      <Avatar src={profile.avatarUrl} name={profile.displayName} size="xl" />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl font-semibold text-(--color-text-primary)">{profile.displayName}</h1>
        <p className="text-sm text-(--color-text-secondary)">@{profile.username}</p>
        {profile.statusText && (
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            {profile.statusEmoji ? `${profile.statusEmoji} ` : ""}
            {profile.statusText}
          </p>
        )}
        {profile.bio && <p className="mt-2 max-w-sm text-sm text-(--color-text-secondary)">{profile.bio}</p>}
      </div>

      {canMessage ? (
        <Button onClick={startConversation} disabled={pending}>
          <MessageCircle size={16} />
          {pending ? "Opening…" : "Message"}
        </Button>
      ) : (
        <p className="text-sm text-(--color-text-tertiary)">You can&apos;t message this user.</p>
      )}
      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
    </div>
  );
}
