import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-md) text-sm font-medium transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-(--color-primary) text-(--color-primary-fg) hover:bg-(--color-primary-hover)",
        secondary:
          "bg-(--color-surface-raised) text-(--color-text-primary) border border-(--color-border) hover:border-(--color-border-strong)",
        ghost: "text-(--color-text-primary) hover:bg-(--color-surface-raised)",
        danger: "bg-(--color-danger) text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
