"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, IconButton, Input } from "@samva/ui";

export function CreateChannelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (!open) return null;

  function reset() {
    setName("");
    setDescription("");
    setIsPublic(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, isPublic }),
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
          <h2 className="text-base font-semibold">Create a channel</h2>
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            aria-label="Channel name"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Description"
            rows={3}
            className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
          />
          <label className="flex items-center justify-between rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-(--color-text-primary)">Public</span>
              <span className="block text-xs text-(--color-text-secondary)">Listed in Discover for anyone to follow</span>
            </span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-(--color-primary)"
            />
          </label>
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create channel"}
          </Button>
        </form>
      </div>
    </div>
  );
}
