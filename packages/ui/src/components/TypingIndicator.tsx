import { cn } from "../lib/cn";

export interface TypingIndicatorProps {
  names?: string[];
  className?: string;
}

export function TypingIndicator({ names, className }: TypingIndicatorProps) {
  const label = formatLabel(names);
  return (
    <div className={cn("flex items-center gap-2 text-xs text-(--color-text-secondary)", className)}>
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-(--color-text-tertiary) animate-bounce"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }}
          />
        ))}
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}

function formatLabel(names?: string[]) {
  if (!names || names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}
