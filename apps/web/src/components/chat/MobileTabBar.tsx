"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Users, Phone, Compass, CircleUserRound } from "lucide-react";
import { Badge, cn } from "@samva/ui";
import { useT } from "@/lib/i18n/I18nProvider";

const items = [
  { href: "/chats", key: "nav.chats", icon: MessageCircle },
  { href: "/communities", key: "nav.communities", icon: Users },
  { href: "/calls", key: "nav.calls", icon: Phone },
  { href: "/discover", key: "nav.discover", icon: Compass },
  { href: "/profile", key: "nav.profile", icon: CircleUserRound },
] as const;

export function MobileTabBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav
      aria-label="Primary"
      className="flex items-center justify-around border-t border-(--color-border) bg-(--color-surface) py-1.5 md:hidden"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const label = t(key);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-(--color-text-tertiary)",
              active && "text-(--color-primary)",
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            {href === "/chats" && unreadCount > 0 && (
              <Badge size="sm" className="absolute right-1 top-0">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
