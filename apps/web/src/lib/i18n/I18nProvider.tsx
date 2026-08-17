"use client";

import * as React from "react";
import type { Dictionary, Locale } from "./dictionaries";

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function getByPath(dict: Dictionary, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

export function useT() {
  const { dict } = useI18n();
  return React.useCallback(
    (path: string, vars?: Record<string, string>) => {
      let text = getByPath(dict, path);
      if (vars) {
        for (const [key, val] of Object.entries(vars)) {
          text = text.replace(`{${key}}`, val);
        }
      }
      return text;
    },
    [dict],
  );
}
