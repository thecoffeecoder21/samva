"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Users, Phone, Compass, CircleUserRound, Search } from "lucide-react";
import { Badge, IconButton, cn } from "@samva/ui";
import { useT } from "@/lib/i18n/I18nProvider";

const items = [
  { href: "/chats", key: "nav.chats", icon: MessageCircle },
  { href: "/communities", key: "nav.communities", icon: Users },
  { href: "/calls", key: "nav.calls", icon: Phone },
  { href: "/discover", key: "nav.discover", icon: Compass },
  { href: "/profile", key: "nav.profile", icon: CircleUserRound },
] as const;

export function NavRail({ unreadCount = 0, onOpenSearch }: { unreadCount?: number; onOpenSearch?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-16 flex-col items-center gap-1 border-r border-(--color-border) bg-(--color-surface) py-4"
    >
      {onOpenSearch && (
        <IconButton aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)" onClick={onOpenSearch} className="mb-2">
          <Search size={20} strokeWidth={1.75} />
        </IconButton>
      )}
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const label = t(key);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-11 w-11 flex-col items-center justify-center rounded-(--radius-md) text-(--color-text-tertiary) transition-colors duration-(--duration-fast) hover:bg-(--color-surface-raised) hover:text-(--color-text-primary)",
              active && "bg-(--color-primary)/10 text-(--color-primary)",
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            {href === "/chats" && unreadCount > 0 && (
              <Badge size="sm" className="absolute right-1.5 top-1.5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
