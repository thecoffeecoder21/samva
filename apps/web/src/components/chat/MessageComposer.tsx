"use client";

import * as React from "react";
import { Paperclip, Send, Smile, Mic, Square, X, BarChart3, Sparkles } from "lucide-react";
import { Avatar, IconButton, cn } from "@samva/ui";
import type { ConversationMemberSummary, Message, MessageEffect } from "@samva/types";
import { useT } from "@/lib/i18n/I18nProvider";
import { EmojiPicker } from "./EmojiPicker";

/** Matches an in-progress "@partial" mention token ending at the caret. */
const MENTION_TRIGGER = /(?:^|\s)@([a-zA-Z0-9_]{0,20})$/;

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
  onEditLast?: () => void;
  uploadProgress: number | null;
  members?: ConversationMemberSummary[];
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
  onEditLast,
  uploadProgress,
  members = [],
}: MessageComposerProps) {
  const t = useT();
  const [value, setValue] = React.useState("");
  const [selectedEffect, setSelectedEffect] = React.useState<MessageEffect | null>(null);
  const [effectPickerOpen, setEffectPickerOpen] = React.useState(false);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const caretPosRef = React.useRef(0);

  const mentionCandidates = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.username.toLowerCase().startsWith(q) || m.displayName.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mentionQuery, members]);

  function updateMentionState(text: string, caret: number) {
    const match = MENTION_TRIGGER.exec(text.slice(0, caret));
    if (match) {
      setMentionQuery(match[1] ?? "");
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function selectMention(member: ConversationMemberSummary) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = MENTION_TRIGGER.exec(before);
    if (!match) return;
    const start = before.length - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
    const next = `${value.slice(0, start)}@${member.username} ${value.slice(caret)}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = start + member.username.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }
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

  function handleChange(next: string, caret: number) {
    setValue(next);
    updateMentionState(next, caret);
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
    setMentionQuery(null);
    setEmojiPickerOpen(false);
    caretPosRef.current = 0;
    clearTimeout(typingTimeout.current);
    onTyping(false);
  }

  function insertEmoji(emoji: string) {
    const caret = caretPosRef.current;
    const next = `${value.slice(0, caret)}${emoji}${value.slice(caret)}`;
    setValue(next);
    const pos = caret + emoji.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
      caretPosRef.current = pos;
    });
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
          <div className="relative">
            <IconButton
              aria-label="Emoji picker"
              onClick={() => setEmojiPickerOpen((v) => !v)}
              className={emojiPickerOpen ? "text-(--color-primary)" : undefined}
            >
              <Smile size={20} strokeWidth={1.75} />
            </IconButton>
            {emojiPickerOpen && (
              <EmojiPicker
                onSelect={(emoji) => insertEmoji(emoji)}
                onClose={() => setEmojiPickerOpen(false)}
              />
            )}
          </div>
          <div className="relative flex-1">
            {mentionQuery !== null && mentionCandidates.length > 0 && (
              <div
                role="listbox"
                aria-label="Mention a member"
                className="absolute bottom-full left-0 z-10 mb-1 w-56 overflow-hidden rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) py-1 shadow-(--shadow-md)"
              >
                {mentionCandidates.map((member, i) => (
                  <button
                    key={member.userId}
                    type="button"
                    role="option"
                    aria-selected={i === mentionIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMention(member);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-(--color-surface-raised)",
                      i === mentionIndex && "bg-(--color-surface-raised)",
                    )}
                  >
                    <Avatar src={member.avatarUrl} name={member.displayName} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-(--color-text-primary)">{member.displayName}</span>{" "}
                      <span className="text-(--color-text-tertiary)">@{member.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                caretPosRef.current = e.target.selectionStart;
                handleChange(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) => {
                caretPosRef.current = e.currentTarget.selectionStart;
              }}
              onKeyUp={(e) => {
                caretPosRef.current = e.currentTarget.selectionStart;
              }}
              onPaste={(e) => {
                const file = Array.from(e.clipboardData.items)
                  .find((item) => item.kind === "file")
                  ?.getAsFile();
                if (file) {
                  e.preventDefault();
                  onSendFile(file);
                }
              }}
              onKeyDown={(e) => {
                if (mentionQuery !== null && mentionCandidates.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    selectMention(mentionCandidates[mentionIndex]!);
                    return;
                  }
                  if (e.key === "Escape") {
                    setMentionQuery(null);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                  return;
                }
                if (e.key === "Escape" && (editingMessage || replyTo)) {
                  e.preventDefault();
                  if (editingMessage) onCancelEdit?.();
                  else onCancelReply?.();
                  return;
                }
                if (e.key === "ArrowUp" && value === "" && !editingMessage && onEditLast) {
                  e.preventDefault();
                  onEditLast();
                }
              }}
              placeholder={t("composer.placeholder")}
              rows={1}
              className="max-h-32 w-full resize-none rounded-(--radius-md) border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-primary) focus:outline-none"
            />
          </div>
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

