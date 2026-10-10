"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@samva/ui";
import { EMOJI_CATEGORIES } from "@/lib/emojiData";

const RECENTS_KEY = "samva:recent-emoji";
const MAX_RECENTS = 24;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(emoji: string): string[] {
  const next = [emoji, ...readRecents().filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / blocked storage — recents just won't persist.
  }
  return next;
}

export function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState(0);
  const [recents, setRecents] = React.useState<string[]>(() => readRecents());
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function select(emoji: string) {
    setRecents(pushRecent(emoji));
    onSelect(emoji);
  }

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter(
        (e) => e.keywords.includes(trimmed) || e.char === trimmed,
      )
    : null;

  return (
    <div
      ref={rootRef}
      className="absolute bottom-full left-0 z-20 mb-1 flex h-80 w-72 flex-col overflow-hidden rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-lg)"
    >
      <div className="flex items-center gap-2 border-b border-(--color-border) px-2 py-2">
        <Search size={14} className="shrink-0 text-(--color-text-tertiary)" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          className="w-full bg-transparent text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-(--color-text-tertiary)">No emoji found.</p>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {filtered.map((e) => (
                <button
                  key={e.char}
                  onClick={() => select(e.char)}
                  title={e.keywords.split(" ")[0]}
                  className="rounded-(--radius-sm) py-1 text-xl hover:bg-(--color-surface-raised)"
                >
                  {e.char}
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {recents.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-text-tertiary)">
                  Recently used
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {recents.map((char) => (
                    <button
                      key={char}
                      onClick={() => select(char)}
                      className="rounded-(--radius-sm) py-1 text-xl hover:bg-(--color-surface-raised)"
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-text-tertiary)">
              {EMOJI_CATEGORIES[activeCategory]!.label}
            </p>
            <div className="grid grid-cols-7 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory]!.emojis.map((e) => (
                <button
                  key={e.char}
                  onClick={() => select(e.char)}
                  title={e.keywords.split(" ")[0]}
                  className="rounded-(--radius-sm) py-1 text-xl hover:bg-(--color-surface-raised)"
                >
                  {e.char}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!filtered && (
        <div className="flex shrink-0 items-center justify-around border-t border-(--color-border) px-1 py-1.5">
          {EMOJI_CATEGORIES.map((c, i) => (
            <button
              key={c.label}
              aria-label={c.label}
              onClick={() => setActiveCategory(i)}
              className={cn(
                "rounded-(--radius-sm) px-1.5 py-1 text-base hover:bg-(--color-surface-raised)",
                i === activeCategory && "bg-(--color-surface-raised)",
              )}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
