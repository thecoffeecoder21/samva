import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@samva/ui";
import { getLocale } from "@/lib/i18n/getLocale";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// First Indic script wired end-to-end (Hindi/Marathi UI + content). Section 8
// plans Tamil/Telugu/Bengali/Kannada/Malayalam/Gujarati/Punjabi as follow-ups —
// each is one more next/font/google entry + fallback in the --font-sans stack.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Samva",
    template: "%s · Samva",
  },
  description: "Samva — built in India, connected everywhere. Chat, communities and calls in one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#14161b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-(--color-bg) text-(--color-text-primary)">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/chats"
          signUpFallbackRedirectUrl="/onboarding"
        >
          <I18nProvider locale={locale} dict={dict}>
            <ThemeProvider>{children}</ThemeProvider>
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
