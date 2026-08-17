"use client";

import * as React from "react";
import { Paperclip, Send, Smile, Mic, Square, X, BarChart3, Sparkles } from "lucide-react";
import { IconButton, cn } from "@samva/ui";
import type { Message, MessageEffect } from "@samva/types";
import { useT } from "@/lib/i18n/I18nProvider";

const EFFECT_OPTIONS: { effect: MessageEffect; emoji: string; label: string }[] = [
  { effect: "confetti", emoji: "🎉", label: "Confetti" },
  { effect: "balloons", emoji: "🎈", label: "Balloons" },
  { effect: "hearts", emoji: "❤️", label: "Hearts" },
  { effect: "fireworks", emoji: "🎆", label: "Fireworks" },
];

export interface MessageComposerProps {
  replyTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onSend: (content: string, effect?: MessageEffect | null) => void;
  onSaveEdit: (messageId: string, content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onSendFile: (file: File) => void;
  onSendVoiceNote: (blob: Blob, durationMs: number, mimeType: string) => void;
  onCreatePoll: () => void;
  uploadProgress: number | null;
}

export function MessageComposer({
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
  onSendFile,
  onSendVoiceNote,
  onCreatePoll,
  uploadProgress,
}: MessageComposerProps) {
  const t = useT();
  const [value, setValue] = React.useState("");
  const [selectedEffect, setSelectedEffect] = React.useState<MessageEffect | null>(null);
  const [effectPickerOpen, setEffectPickerOpen] = React.useState(false);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [recording, setRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordingChunksRef = React.useRef<Blob[]>([]);
  const recordingStartRef = React.useRef(0);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Reset the draft to the target message's content whenever editing starts
  // on a *different* message — adjusting state during render (React's
  // documented alternative to an effect for this exact case) instead of an
  // effect that would call setState after the fact.
  const editingId = editingMessage?.id ?? null;
  const [lastEditingId, setLastEditingId] = React.useState<string | null>(null);
  if (editingId !== lastEditingId) {
    setLastEditingId(editingId);
    setValue(editingId ? (editingMessage?.content ?? "") : "");
  }

  function handleChange(next: string) {
    setValue(next);
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 2000);
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (editingMessage) {
      onSaveEdit(editingMessage.id, trimmed);
    } else {
      onSend(trimmed, selectedEffect);
      setSelectedEffect(null);
    }
    setValue("");
    clearTimeout(typingTimeout.current);
    onTyping(false);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onSendFile(file);
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      clearInterval(recordingTimerRef.current);
      const durationMs = Date.now() - recordingStartRef.current;
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });
      setRecording(false);
      setRecordingSeconds(0);
      if (durationMs > 500) onSendVoiceNote(blob, durationMs, mimeType);
    };
    recorderRef.current = recorder;
    recordingStartRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  const context = editingMessage ?? replyTo;
  const contextLabel = editingMessage ? "Editing message" : replyTo ? "Replying" : null;

  return (
    <div className="border-t border-(--color-border) bg-(--color-surface) px-4 py-3">
      {context && contextLabel && (
        <div className="mb-2 flex items-center justify-between rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-1.5 text-xs">
          <span className="truncate text-(--color-text-secondary)">
            <span className="font-medium text-(--color-text-primary)">{contextLabel}: </span>
            {context.content ?? "Attachment"}
          </span>
          <button
            onClick={editingMessage ? onCancelEdit : onCancelReply}
            aria-label="Cancel"
            className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {uploadProgress !== null && (
        <div className="mb-2 h-1 overflow-hidden rounded-(--radius-full) bg-(--color-surface-raised)">
          <div
            className="h-full bg-(--color-primary) transition-all duration-(--duration-fast)"
            style={{ width: `${Math.max(5, uploadProgress)}%` }}
          />
        </div>
      )}
      {recording ? (
        <div className="flex items-center gap-3 rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-(--color-danger)" />
          <span className="flex-1 text-sm text-(--color-text-secondary)">
            Recording… {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
            {String(recordingSeconds % 60).padStart(2, "0")}
          </span>
          <IconButton aria-label="Stop and send voice message" onClick={stopRecording}>
            <Square size={18} className="text-(--color-danger)" fill="currentColor" />
          </IconButton>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={handleFileSelected}
          />
          <IconButton aria-label="Attach a file" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={20} strokeWidth={1.75} />
          </IconButton>
          <IconButton aria-label="Create a poll" onClick={onCreatePoll}>
            <BarChart3 size={20} strokeWidth={1.75} />
          </IconButton>
          <div className="relative">
            <IconButton
              aria-label="Send with effect"
              onClick={() => setEffectPickerOpen((v) => !v)}
              className={selectedEffect ? "text-(--color-primary)" : undefined}
            >
              <Sparkles size={20} strokeWidth={1.75} />
            </IconButton>
            {effectPickerOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-md)">
                <button
                  className={cn(
                    "rounded-(--radius-sm) px-2 py-1.5 text-xs hover:bg-(--color-surface-raised)",
                    !selectedEffect && "bg-(--color-surface-raised)",
                  )}
                  onClick={() => {
                    setSelectedEffect(null);
                    setEffectPickerOpen(false);
                  }}
                >
                  None
                </button>
                {EFFECT_OPTIONS.map((option) => (
                  <button
                    key={option.effect}
                    aria-label={option.label}
                    className={cn(
                      "rounded-(--radius-sm) px-1.5 py-1 text-base hover:bg-(--color-surface-raised)",
                      selectedEffect === option.effect && "bg-(--color-surface-raised)",
                    )}
                    onClick={() => {
                      setSelectedEffect(option.effect);
                      setEffectPickerOpen(false);
                    }}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <IconButton aria-label="Emoji picker (coming soon)" title="Emoji picker is coming soon" disabled>
            <Smile size={20} strokeWidth={1.75} />
          </IconButton>
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("composer.placeholder")}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-(--radius-md) border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
          />
          {value.trim() ? (
            <IconButton aria-label={t("composer.send")} onClick={submit}>
              <Send size={20} strokeWidth={1.75} className="text-(--color-primary)" />
            </IconButton>
          ) : (
            <IconButton aria-label={t("composer.recordVoice")} onClick={startRecording}>
              <Mic size={20} strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

