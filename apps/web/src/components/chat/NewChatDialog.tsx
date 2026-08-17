"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, IconButton, Input, cn } from "@samva/ui";

export function NewChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"direct" | "group">("direct");
  const [username, setUsername] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [usernamesText, setUsernamesText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (!open) return null;

  function reset() {
    setUsername("");
    setGroupName("");
    setUsernamesText("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body =
        mode === "group"
          ? {
              type: "group" as const,
              name: groupName,
              usernames: usernamesText
                .split(/[\n,]/)
                .map((u) => u.trim())
                .filter(Boolean),
            }
          : { username };

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      onClose();
      reset();
      router.push(`/chats/${data.conversationId}`);
      router.refresh();
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    mode === "direct" ? Boolean(username.trim()) : Boolean(groupName.trim() && usernamesText.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => {
        onClose();
        reset();
      }}
    >
      <div
        className="w-full max-w-sm rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-5 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{mode === "direct" ? "Start a new chat" : "Create a group"}</h2>
          <IconButton
            aria-label="Close"
            size="sm"
            onClick={() => {
              onClose();
              reset();
            }}
          >
            <X size={18} />
          </IconButton>
        </div>

        <div className="mb-4 flex gap-1 rounded-(--radius-md) bg-(--color-surface-raised) p-1">
          {(["direct", "group"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-(--radius-sm) py-1.5 text-sm font-medium transition-colors duration-(--duration-fast)",
                mode === m
                  ? "bg-(--color-surface) text-(--color-text-primary) shadow-(--shadow-sm)"
                  : "text-(--color-text-secondary)",
              )}
            >
              {m === "direct" ? "Direct message" : "Group"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "direct" ? (
            <div className="flex items-center gap-2">
              <span className="text-(--color-text-tertiary)">@</span>
              <Input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                aria-label="Username"
              />
            </div>
          ) : (
            <>
              <Input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                aria-label="Group name"
              />
              <textarea
                value={usernamesText}
                onChange={(e) => setUsernamesText(e.target.value)}
                placeholder="Usernames, separated by commas or new lines (e.g. alice, bob)"
                aria-label="Member usernames"
                rows={3}
                className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
              />
            </>
          )}
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          <Button type="submit" disabled={pending || !canSubmit}>
            {pending ? "Creating…" : mode === "direct" ? "Start chat" : "Create group"}
          </Button>
        </form>
      </div>
    </div>
  );
}
