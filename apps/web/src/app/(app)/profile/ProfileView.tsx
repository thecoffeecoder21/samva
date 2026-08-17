"use client";

import * as React from "react";
import { SignOutButton, useClerk } from "@clerk/nextjs";
import { LogOut, Bell, BellOff, ShieldCheck } from "lucide-react";
import { Avatar, Button } from "@samva/ui";
import type { profiles } from "@samva/db";
import { disablePushNotifications, enablePushNotifications, getPushSubscriptionState, isPushSupported } from "@/lib/push";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ShareProfileCard } from "@/components/chat/ShareProfileCard";

export function ProfileView({ profile }: { profile: typeof profiles.$inferSelect }) {
  const clerk = useClerk();
  const t = useT();
  // Both default to the SSR-safe "nothing to show" state — isPushSupported()
  // depends on `window`/`navigator`, so calling it directly during render
  // disagrees with the server's render and trips a hydration mismatch. Only
  // flip these after mount, in the effect below.
  const [supported, setSupported] = React.useState(false);
  const [pushState, setPushState] = React.useState<"unsupported" | "granted" | "denied" | "default" | "loading">(
    "loading",
  );
  const [pushError, setPushError] = React.useState<string | null>(null);
  const [subscribing, setSubscribing] = React.useState(false);

  React.useEffect(() => {
    getPushSubscriptionState().then((state) => {
      setSupported(isPushSupported());
      setPushState(state);
    });
  }, []);

  async function handleEnableNotifications() {
    setPushError(null);
    setSubscribing(true);
    try {
      // The subscribe handshake with the browser's push service (e.g.
      // Google's FCM) can genuinely take several seconds on a first
      // subscription — this isn't a hang, but the button needs its own
      // pending state or a real click looks like it did nothing.
      const result = await enablePushNotifications();
      if (!result.ok) {
        setPushError(result.error ?? "Couldn't enable notifications.");
        return;
      }
      setPushState(await getPushSubscriptionState());
    } finally {
      setSubscribing(false);
    }
  }

  async function handleDisableNotifications() {
    await disablePushNotifications();
    setPushState("default");
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-16">
      <Avatar src={profile.avatarUrl} name={profile.displayName} size="xl" />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl font-semibold text-(--color-text-primary)">{profile.displayName}</h1>
        <p className="text-sm text-(--color-text-secondary)">@{profile.username}</p>
        {profile.statusText && (
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            {profile.statusEmoji ? `${profile.statusEmoji} ` : ""}
            {profile.statusText}
          </p>
        )}
        {profile.bio && <p className="mt-2 max-w-sm text-sm text-(--color-text-secondary)">{profile.bio}</p>}
      </div>

      <div className="flex flex-col items-center gap-2">
        {supported && pushState !== "unsupported" && (
          <Button
            variant="secondary"
            onClick={pushState === "granted" ? handleDisableNotifications : handleEnableNotifications}
            disabled={pushState === "loading" || pushState === "denied" || subscribing}
          >
            {pushState === "granted" ? <BellOff size={16} /> : <Bell size={16} />}
            {subscribing
              ? t("profile.enabling")
              : pushState === "granted"
                ? t("profile.turnOffNotifications")
                : pushState === "denied"
                  ? "Notifications blocked in browser settings"
                  : t("profile.enableNotifications")}
          </Button>
        )}
        {pushError && <p className="text-xs text-(--color-danger)">{pushError}</p>}
      </div>

      <Button variant="secondary" onClick={() => clerk.openUserProfile()}>
        <ShieldCheck size={16} />
        {t("profile.manageAccount")}
      </Button>

      <ShareProfileCard username={profile.username} />
      <ThemeSwitcher />
      <LanguageSwitcher />

      <SignOutButton redirectUrl="/">
        <Button variant="secondary">
          <LogOut size={16} />
          {t("profile.signOut")}
        </Button>
      </SignOutButton>
    </div>
  );
}
