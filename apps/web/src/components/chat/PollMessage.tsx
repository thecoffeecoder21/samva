"use client";

import { Check } from "lucide-react";
import { cn } from "@samva/ui";
import type { Poll } from "@samva/types";

export function PollMessage({
  poll,
  isOwn,
  onVote,
}: {
  poll: Poll;
  isOwn: boolean;
  onVote: (optionId: string) => void;
}) {
  return (
    <div className="flex min-w-56 flex-col gap-2.5">
      <p className="font-semibold">{poll.question}</p>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((option) => {
          const pct = poll.totalVotes > 0 ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;
          return (
            <button
              key={option.id}
              onClick={() => onVote(option.id)}
              className={cn(
                "relative overflow-hidden rounded-(--radius-md) border px-3 py-2 text-left text-sm transition-colors duration-(--duration-fast)",
                isOwn ? "border-white/30" : "border-(--color-border)",
                option.votedByMe && (isOwn ? "bg-white/15" : "bg-(--color-primary)/10"),
              )}
            >
              <div
                className={cn("absolute inset-y-0 left-0 -z-0", isOwn ? "bg-white/10" : "bg-(--color-primary)/10")}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {option.votedByMe && <Check size={14} className="shrink-0" />}
                  <span className="truncate">{option.text}</span>
                </span>
                <span className="shrink-0 text-xs opacity-70">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs opacity-70">
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        {poll.allowMultiple ? " · Multiple answers allowed" : ""}
      </p>
    </div>
  );
}
