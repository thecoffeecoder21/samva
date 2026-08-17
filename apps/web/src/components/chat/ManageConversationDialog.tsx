"use client";

import * as React from "react";
import { X, Shield, ShieldOff, UserMinus, Crown } from "lucide-react";
import { Avatar, Button, IconButton, Input, cn } from "@samva/ui";
import type { ConversationMemberSummary, ConversationRole, ConversationType } from "@samva/types";
import { classifyFile, uploadAttachment } from "@/lib/uploadFile";

export interface ManageConversationDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  type: ConversationType;
  currentUserId: string;
  myRole: ConversationRole;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  isPublic: boolean;
  onUpdated: (patch: { name?: string; avatarUrl?: string | null; description?: string | null; isPublic?: boolean }) => void;
}

export function ManageConversationDialog({
  open,
  onClose,
  conversationId,
  type,
  currentUserId,
  myRole,
  name,
  avatarUrl,
  description,
  isPublic,
  onUpdated,
}: ManageConversationDialogProps) {
  const canEdit = myRole === "owner" || myRole === "admin";
  const noun = type === "channel" ? "channel" : "group";

  const [members, setMembers] = React.useState<ConversationMemberSummary[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(name);
  const [descriptionDraft, setDescriptionDraft] = React.useState(description ?? "");
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [addUsernames, setAddUsernames] = React.useState("");
  const [addPending, setAddPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  // Reset the drafts whenever the dialog transitions to open — adjusting
  // state during render (React's documented alternative to an effect for
  // this) instead of an effect, since `name`/`description` deliberately stay
  // excluded from the dependency list below: a live rename via realtime
  // shouldn't blow away in-progress edits while the dialog is already open.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNameDraft(name);
      setDescriptionDraft(description ?? "");
      setError(null);
      setLoadingMembers(true);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/conversations/${conversationId}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMembers(data.members ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  if (!open) return null;

  async function saveInfo() {
    setSavingInfo(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim(), description: descriptionDraft.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save changes.");
        return;
      }
      onUpdated({ name: data.name, description: data.description });
    } finally {
      setSavingInfo(false);
    }
  }

  async function togglePublic() {
    const next = !isPublic;
    onUpdated({ isPublic: next });
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    if (!res.ok) onUpdated({ isPublic: !next });
  }

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { kind } = classifyFile(file.type);
    if (kind !== "image") {
      setError("Please choose an image file.");
      return;
    }
    setUploadingAvatar(true);
    setError(null);
    try {
      const attachment = await uploadAttachment(file, file.name, conversationId, "image");
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: attachment.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update the photo.");
        return;
      }
      onUpdated({ avatarUrl: data.avatarUrl });
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function addMembers(e: React.FormEvent) {
    e.preventDefault();
    const usernames = addUsernames
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (usernames.length === 0) return;
    setAddPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add members.");
        return;
      }
      setAddUsernames("");
      const membersRes = await fetch(`/api/conversations/${conversationId}/members`);
      setMembers((await membersRes.json()).members ?? []);
    } finally {
      setAddPending(false);
    }
  }

  async function changeRole(userId: string, role: "admin" | "member") {
    setError(null);
    const previous = members;
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    const res = await fetch(`/api/conversations/${conversationId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setMembers(previous);
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Couldn't change role.");
    }
  }

  async function removeMember(userId: string) {
    setError(null);
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    const res = await fetch(`/api/conversations/${conversationId}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      setMembers(previous);
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Couldn't remove member.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-5 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold capitalize">{noun} info</h2>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar src={avatarUrl} name={name} size="xl" />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 rounded-(--radius-full) bg-(--color-primary) px-1.5 py-1 text-[10px] font-medium text-(--color-primary-fg) shadow-(--shadow-sm)"
                >
                  {uploadingAvatar ? "…" : "Edit"}
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelected} />
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-col gap-2">
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder={`${noun} name`} aria-label={`${noun} name`} />
              <textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                placeholder="Description (optional)"
                aria-label="Description"
                rows={2}
                className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={savingInfo || !nameDraft.trim()}
                onClick={saveInfo}
              >
                {savingInfo ? "Saving…" : "Save changes"}
              </Button>
              {type === "channel" && (
                <label className="flex items-center justify-between rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-(--color-text-primary)">Public channel</span>
                    <span className="block text-xs text-(--color-text-secondary)">Listed in Discover for anyone to follow</span>
                  </span>
                  <input type="checkbox" checked={isPublic} onChange={togglePublic} className="h-4 w-4 accent-(--color-primary)" />
                </label>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-base font-semibold text-(--color-text-primary)">{name}</p>
              {description && <p className="mt-1 text-sm text-(--color-text-secondary)">{description}</p>}
            </div>
          )}

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          {canEdit && (
            <form onSubmit={addMembers} className="flex flex-col gap-2 border-t border-(--color-border) pt-3">
              <p className="text-xs font-medium text-(--color-text-secondary)">Add members</p>
              <div className="flex gap-2">
                <Input
                  value={addUsernames}
                  onChange={(e) => setAddUsernames(e.target.value)}
                  placeholder="usernames, comma-separated"
                  aria-label="Usernames to add"
                />
                <Button type="submit" size="sm" disabled={addPending || !addUsernames.trim()}>
                  Add
                </Button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-1 border-t border-(--color-border) pt-3">
            <p className="mb-1 text-xs font-medium text-(--color-text-secondary)">
              {members.length} {type === "channel" ? "follower" : "member"}
              {members.length === 1 ? "" : "s"}
            </p>
            {loadingMembers ? (
              <p className="py-4 text-center text-sm text-(--color-text-tertiary)">Loading…</p>
            ) : (
              members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 rounded-(--radius-md) px-1 py-1.5">
                  <Avatar src={m.avatarUrl} name={m.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-(--color-text-primary)">
                      {m.displayName} {m.userId === currentUserId && <span className="text-(--color-text-tertiary)">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-(--color-text-tertiary)">@{m.username}</p>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-(--radius-full) px-2 py-0.5 text-[10px] font-medium capitalize",
                      m.role === "owner"
                        ? "bg-(--color-primary)/10 text-(--color-primary)"
                        : m.role === "admin"
                          ? "bg-(--color-surface-raised) text-(--color-text-secondary)"
                          : "text-(--color-text-tertiary)",
                    )}
                  >
                    {m.role === "owner" && <Crown size={10} />}
                    {m.role}
                  </span>
                  {myRole === "owner" && m.role !== "owner" && m.userId !== currentUserId && (
                    <>
                      <IconButton
                        aria-label={m.role === "admin" ? `Remove admin from ${m.displayName}` : `Make ${m.displayName} an admin`}
                        size="sm"
                        onClick={() => changeRole(m.userId, m.role === "admin" ? "member" : "admin")}
                      >
                        {m.role === "admin" ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </IconButton>
                    </>
                  )}
                  {canEdit && m.role !== "owner" && m.userId !== currentUserId && (myRole === "owner" || m.role === "member") && (
                    <IconButton aria-label={`Remove ${m.displayName}`} size="sm" onClick={() => removeMember(m.userId)}>
                      <UserMinus size={14} className="text-(--color-danger)" />
                    </IconButton>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
