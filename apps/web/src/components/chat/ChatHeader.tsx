"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Search, Video, MoreVertical, Ban, ShieldCheck, Timer, TimerOff } from "lucide-react";
import { Avatar, IconButton } from "@samva/ui";

const DISAPPEARING_OPTIONS: { seconds: 3600 | 86400 | 604800 | null; label: string }[] = [
  { seconds: null, label: "Off" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
];

export function ChatHeader({
  title,
  avatarUrl,
  subtitle,
  isOnline,
  showBlockOption,
  isBlockedByMe,
  onToggleBlock,
  disappearingSeconds,
  onSetDisappearing,
}: {
  title: string;
  avatarUrl: string | null;
  subtitle?: string;
  isOnline?: boolean;
  showBlockOption?: boolean;
  isBlockedByMe?: boolean;
  onToggleBlock?: () => void;
  disappearingSeconds?: number | null;
  onSetDisappearing?: (seconds: 3600 | 86400 | 604800 | null) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [disappearingSubmenuOpen, setDisappearingSubmenuOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-3 border-b border-(--color-border) px-4 py-3">
      <Link href="/chats" className="text-(--color-text-secondary) hover:text-(--color-text-primary) md:hidden">
        <ArrowLeft size={20} />
      </Link>
      <Avatar src={avatarUrl} name={title} online={isOnline} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-(--color-text-primary)">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-(--color-text-secondary)" suppressHydrationWarning>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Search in conversation (coming soon)" title="Coming soon" disabled>
          <Search size={18} />
        </IconButton>
        <IconButton aria-label="Start audio call (coming soon)" title="Coming soon" disabled>
          <Phone size={18} />
        </IconButton>
        <IconButton aria-label="Start video call (coming soon)" title="Coming soon" disabled>
          <Video size={18} />
        </IconButton>
        {(showBlockOption || onSetDisappearing) && (
          <div className="relative">
            <IconButton
              aria-label="Conversation options"
              onClick={() => {
                setMenuOpen((v) => !v);
                setDisappearingSubmenuOpen(false);
              }}
            >
              <MoreVertical size={18} />
            </IconButton>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 flex w-52 flex-col rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-md)">
                {onSetDisappearing && (
                  <div className="relative">
                    <button
                      className="flex w-full items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                      onClick={() => setDisappearingSubmenuOpen((v) => !v)}
                    >
                      {disappearingSeconds ? <Timer size={14} /> : <TimerOff size={14} />}
                      Disappearing messages
                      <span className="ml-auto text-(--color-text-tertiary)">
                        {DISAPPEARING_OPTIONS.find((o) => o.seconds === (disappearingSeconds ?? null))?.label ?? "Off"}
                      </span>
                    </button>
                    {disappearingSubmenuOpen && (
                      <div className="mt-1 flex flex-col gap-0.5 border-t border-(--color-border) pt-1">
                        {DISAPPEARING_OPTIONS.map((option) => (
                          <button
                            key={option.label}
                            className="flex items-center justify-between rounded-(--radius-sm) px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                            onClick={() => {
                              onSetDisappearing(option.seconds);
                              setMenuOpen(false);
                              setDisappearingSubmenuOpen(false);
                            }}
                          >
                            {option.label}
                            {(disappearingSeconds ?? null) === option.seconds && (
                              <span className="text-(--color-primary)">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {showBlockOption && (
                  <button
                    className="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left text-xs text-(--color-danger) hover:bg-(--color-surface-raised)"
                    onClick={() => {
                      onToggleBlock?.();
                      setMenuOpen(false);
                    }}
                  >
                    {isBlockedByMe ? <ShieldCheck size={14} /> : <Ban size={14} />}
                    {isBlockedByMe ? "Unblock user" : "Block user"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
