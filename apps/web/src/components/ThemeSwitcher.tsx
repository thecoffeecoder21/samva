"use client";

import * as React from "react";
import { Check, Monitor } from "lucide-react";
import { cn, useTheme, CHAT_THEMES } from "@samva/ui";
import { useT } from "@/lib/i18n/I18nProvider";

const SWATCHES: Record<(typeof CHAT_THEMES)[number], [string, string]> = {
  light: ["#fafbfc", "#5b5fef"],
  dark: ["#14161b", "#818cfa"],
  midnight: ["#0a0c14", "#7c83ff"],
  ocean: ["#f0f8fa", "#0f9b8e"],
  sakura: ["#fff5f7", "#e0648c"],
  forest: ["#0e1712", "#4fae6f"],
};

const LABELS: Record<(typeof CHAT_THEMES)[number], string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  ocean: "Ocean",
  sakura: "Sakura",
  forest: "Forest",
};

export function ThemeSwitcher() {
  // next-themes reports `theme` as undefined until it has read the stored
  // preference client-side — that's its own built-in guard against a
  // hydration mismatch, so nothing here is marked "active" until then
  // instead of needing a separate mounted flag.
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-(--color-text-tertiary)">{t("profile.theme")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setTheme("system")}
          className={cn(
            "flex items-center gap-1.5 rounded-(--radius-md) border px-2.5 py-1.5 text-xs",
            theme === "system"
              ? "border-(--color-primary) text-(--color-primary)"
              : "border-(--color-border) text-(--color-text-secondary)",
          )}
        >
          <Monitor size={14} />
          {t("profile.themeSystem")}
        </button>
        {CHAT_THEMES.map((name) => {
          const [bg, accent] = SWATCHES[name];
          const active = theme === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTheme(name)}
              aria-label={LABELS[name]}
              className={cn(
                "flex items-center gap-1.5 rounded-(--radius-md) border px-2.5 py-1.5 text-xs",
                active ? "border-(--color-primary) text-(--color-primary)" : "border-(--color-border) text-(--color-text-secondary)",
              )}
            >
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10"
                style={{ background: bg }}
              >
                {active && <Check size={9} color={accent} strokeWidth={3} />}
              </span>
              <span style={{ color: active ? accent : undefined }}>{LABELS[name]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
