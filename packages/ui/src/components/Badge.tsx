import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-(--radius-full) font-medium leading-none",
  {
    variants: {
      variant: {
        primary: "bg-(--color-primary) text-(--color-primary-fg)",
        neutral: "bg-(--color-surface-raised) text-(--color-text-secondary) border border-(--color-border)",
        marigold: "bg-(--color-marigold) text-white",
        danger: "bg-(--color-danger) text-white",
      },
      size: {
        sm: "h-4 min-w-4 px-1 text-[10px]",
        md: "h-5 min-w-5 px-1.5 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
