"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@samva/ui";
import { locales, localeNames, type Locale } from "@/lib/i18n/dictionaries";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { setLocale } from "@/app/actions/setLocale";

export function LanguageSwitcher() {
  const { locale } = useI18n();
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSelect(next: Locale) {
    if (next === locale || pending) return;
    setPending(true);
    await setLocale(next);
    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-(--color-text-tertiary)">{t("profile.language")}</p>
      <div className="flex items-center gap-1 rounded-(--radius-md) border border-(--color-border) p-1">
        {locales.map((code) => (
          <button
            key={code}
            type="button"
            disabled={pending}
            onClick={() => handleSelect(code)}
            className={cn(
              "rounded-(--radius-sm) px-3 py-1 text-sm transition-colors duration-(--duration-fast)",
              code === locale
                ? "bg-(--color-primary) text-white"
                : "text-(--color-text-secondary) hover:bg-(--color-surface-raised)",
            )}
          >
            {localeNames[code]}
          </button>
        ))}
      </div>
    </div>
  );
}
