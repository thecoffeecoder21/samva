import Link from "next/link";
import { buttonVariants } from "@samva/ui";
import { getLocale } from "@/lib/i18n/getLocale";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function LandingPage() {
  const locale = await getLocale();
  const t = dictionaries[locale].landing;
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <SamvaMark />
          <span className="text-lg font-semibold tracking-tight">Samva</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/chats" className="text-sm text-(--color-text-secondary) hover:text-(--color-text-primary)">
            {t.openSamva}
          </Link>
          <Link href="/chats" className={buttonVariants({ size: "sm" })}>
            {t.getStarted}
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <span className="rounded-(--radius-full) border border-(--color-border) px-3 py-1 text-xs text-(--color-text-secondary)">
          {t.tagline}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="max-w-xl text-lg text-(--color-text-secondary)">
          {t.heroDescription}
        </p>
        <div className="flex items-center gap-3">
          <Link href="/chats" className={buttonVariants({ size: "lg" })}>
            {t.startConversation}
          </Link>
          <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            {t.signIn}
          </Link>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-center text-xs text-(--color-text-tertiary)">
        Samva — talk, work, create, connect.
      </footer>
    </main>
  );
}

function SamvaMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="13" stroke="var(--color-primary)" strokeWidth="1.5" />
      <path
        d="M9 12.5c0-1.9 1.6-3.5 3.5-3.5h2c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5h-4L9 19v-3.2c0-.2 0-.2 0 0"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
