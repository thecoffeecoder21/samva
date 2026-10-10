"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "@samva/ui";

export function ReportMessageDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-5 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Report message</h2>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <p className="text-sm text-(--color-text-secondary)">
          This sends the message to the channel&rsquo;s owners and admins for review.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's wrong with this message? (optional)"
          aria-label="Reason for reporting"
          rows={3}
          className="rounded-(--radius-md) border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
        />
        <Button
          onClick={() => onSubmit(reason.trim() || "No reason given")}
          className="self-end"
        >
          Submit report
        </Button>
      </div>
    </div>
  );
}
