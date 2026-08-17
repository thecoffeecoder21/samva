import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCurrentProfile } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profile = await getCurrentProfile();
  if (profile) redirect("/chats");

  const clerkUser = await currentUser();
  const defaultName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ");
  const locale = await getLocale();
  const t = dictionaries[locale].onboarding;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="max-w-sm text-sm text-(--color-text-secondary)">{t.description}</p>
      </div>
      <OnboardingForm defaultName={defaultName || undefined} />
    </div>
  );
}
