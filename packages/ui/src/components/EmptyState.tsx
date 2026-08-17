import * as React from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      {icon && <div className="text-(--color-text-tertiary)">{icon}</div>}
      <p className="text-base font-medium text-(--color-text-primary)">{title}</p>
      {description && <p className="max-w-xs text-sm text-(--color-text-secondary)">{description}</p>}
      {action}
    </div>
  );
}
