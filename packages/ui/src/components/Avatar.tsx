import * as React from "react";
import { cn } from "../lib/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({ src, name, size = "md", online, className, ...props }: AvatarProps) {
  return (
    <div className={cn("relative shrink-0", sizeMap[size], className)} {...props}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar sources are user/CDN URLs of arbitrary hosts
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-(--radius-full) object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-(--radius-full) bg-(--color-primary) font-semibold text-(--color-primary-fg)">
          {initials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-(--color-surface)",
            online ? "bg-(--color-success)" : "bg-(--color-text-tertiary)",
          )}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
