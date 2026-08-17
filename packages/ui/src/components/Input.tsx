"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) transition-colors duration-(--duration-fast) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
