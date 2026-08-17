"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// The real, selectable theme values — "system" is a separate pseudo-value
// next-themes handles via enableSystem/defaultTheme, not a member of this list.
export const CHAT_THEMES = ["light", "dark", "midnight", "ocean", "sakura", "forest"] as const;
export type ChatTheme = (typeof CHAT_THEMES)[number];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem themes={[...CHAT_THEMES]}>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme } from "next-themes";
