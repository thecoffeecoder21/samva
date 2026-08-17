"use client";

import * as React from "react";
import { FileText, Download, Play, Pause } from "lucide-react";
import { cn } from "@samva/ui";
import type { Message, MessageAttachment } from "@samva/types";

export function MessageAttachments({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (message.attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {message.attachments.map((attachment) =>
        message.type === "image" ? (
          <ImageAttachment key={attachment.id} attachment={attachment} />
        ) : message.type === "video" ? (
          <VideoAttachment key={attachment.id} attachment={attachment} />
        ) : message.type === "voice" || message.type === "audio" ? (
          <AudioAttachment key={attachment.id} attachment={attachment} isOwn={isOwn} />
        ) : (
          <DocumentAttachment key={attachment.id} attachment={attachment} isOwn={isOwn} />
        ),
      )}
    </div>
  );
}

function ImageAttachment({ attachment }: { attachment: MessageAttachment }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="block overflow-hidden rounded-(--radius-md)">
        {/* eslint-disable-next-line @next/next/no-img-element -- external Blob CDN URL */}
        <img
          src={attachment.url}
          alt={attachment.fileName ?? "Image"}
          className="max-h-72 w-auto max-w-full object-cover"
          style={attachment.width && attachment.height ? { aspectRatio: `${attachment.width}/${attachment.height}` } : undefined}
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external Blob CDN URL */}
          <img
            src={attachment.url}
            alt={attachment.fileName ?? "Image"}
            className="max-h-full max-w-full rounded-(--radius-md) object-contain"
          />
        </div>
      )}
    </>
  );
}

function VideoAttachment({ attachment }: { attachment: MessageAttachment }) {
  return (
    <video src={attachment.url} controls className="max-h-72 max-w-full rounded-(--radius-md)" />
  );
}

function AudioAttachment({ attachment, isOwn }: { attachment: MessageAttachment; isOwn: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  }

  const durationLabel = attachment.durationMs
    ? `${Math.floor(attachment.durationMs / 1000 / 60)}:${String(Math.floor((attachment.durationMs / 1000) % 60)).padStart(2, "0")}`
    : null;

  return (
    <div className="flex min-w-[220px] items-center gap-3 rounded-(--radius-md) bg-black/5 px-3 py-2">
      <audio
        ref={audioRef}
        src={attachment.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-full)",
          isOwn ? "bg-white/20" : "bg-(--color-primary)/15 text-(--color-primary)",
        )}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-(--radius-full) bg-current/20">
        <div className="h-full bg-current/60" style={{ width: `${progress * 100}%` }} />
      </div>
      {durationLabel && <span className="shrink-0 text-xs opacity-70">{durationLabel}</span>}
    </div>
  );
}

function DocumentAttachment({ attachment, isOwn }: { attachment: MessageAttachment; isOwn: boolean }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      download={attachment.fileName ?? undefined}
      className={cn(
        "flex min-w-[220px] items-center gap-3 rounded-(--radius-md) px-3 py-2",
        isOwn ? "bg-white/15" : "bg-black/5",
      )}
    >
      <FileText size={24} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.fileName ?? "Document"}</p>
        {attachment.sizeBytes && <p className="text-[11px] opacity-70">{formatBytes(attachment.sizeBytes)}</p>}
      </div>
      <Download size={16} className="shrink-0 opacity-70" />
    </a>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
