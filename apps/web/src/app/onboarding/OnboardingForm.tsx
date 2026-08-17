"use client";

import { useActionState } from "react";
import { Button, Input } from "@samva/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const t = useT();

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          {t("onboarding.displayNameLabel")}
        </label>
        <Input id="displayName" name="displayName" defaultValue={defaultName} placeholder="Ananya Sharma" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          {t("onboarding.usernameLabel")}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-(--color-text-tertiary)">@</span>
          <Input id="username" name="username" placeholder="ananya" pattern="[a-z0-9_]{3,20}" required />
        </div>
      </div>
      {state.error && <p className="text-sm text-(--color-danger)">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t("onboarding.saving") : t("onboarding.continue")}
      </Button>
    </form>
  );
}
