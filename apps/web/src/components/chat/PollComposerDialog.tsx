"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, IconButton, Input } from "@samva/ui";

export function PollComposerDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[], allowMultiple: boolean) => void;
}) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = React.useState(false);

  // Reset the draft the moment the dialog re-opens — adjusting state during
  // render (React's documented pattern) rather than an effect.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
    }
  }

  if (!open) return null;

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && trimmedOptions.length >= 2;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => (prev.length >= 10 ? prev : [...prev, ""]));
  }

  function removeOption(index: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  function submit() {
    if (!canCreate) return;
    onCreate(question.trim(), trimmedOptions, allowMultiple);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col gap-3 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-4 shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Create a poll</h2>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Poll question"
          maxLength={300}
        />
        <div className="flex flex-col gap-2 overflow-y-auto">
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                aria-label={`Poll option ${i + 1}`}
                maxLength={120}
              />
              {options.length > 2 && (
                <IconButton aria-label={`Remove option ${i + 1}`} size="sm" onClick={() => removeOption(i)}>
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            onClick={addOption}
            className="flex items-center gap-1.5 self-start text-sm text-(--color-primary) hover:underline"
          >
            <Plus size={14} /> Add option
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="h-4 w-4 rounded border-(--color-border)"
          />
          Allow multiple answers
        </label>
        <Button onClick={submit} disabled={!canCreate}>
          Create poll
        </Button>
      </div>
    </div>
  );
}
