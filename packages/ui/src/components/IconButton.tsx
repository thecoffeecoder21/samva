"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md";
}

const sizeMap = { sm: "h-8 w-8", md: "h-10 w-10" };

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-(--radius-full) text-(--color-text-secondary) transition-colors duration-(--duration-fast) hover:bg-(--color-surface-raised) hover:text-(--color-text-primary) disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)",
        sizeMap[size],
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
