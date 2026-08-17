import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@samva/ui";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon={<Icon size={40} strokeWidth={1.25} />}
      title={title}
      description={description}
      className="h-full"
    />
  );
}
