"use client";

import * as React from "react";
import type { MessageEffect } from "@samva/types";

const EFFECT_EMOJI: Record<MessageEffect, string> = {
  confetti: "🎉",
  balloons: "🎈",
  hearts: "❤️",
  fireworks: "🎆",
};

const PARTICLE_COUNT = 24;
const DURATION_MS = 2600;

export function MessageEffectOverlay({ effect, onDone }: { effect: MessageEffect; onDone: () => void }) {
  // Randomizing per-particle placement only needs to happen once per mount
  // — a lazy useState initializer (unlike a plain render-body call or even
  // useMemo) is the React-documented escape hatch for one-time non-pure
  // work, since it runs exactly once for the life of this component instance.
  const [particles] = React.useState(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.2,
      size: 20 + Math.random() * 20,
      drift: (Math.random() - 0.5) * 120,
    })),
  );

  React.useEffect(() => {
    const timeout = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timeout);
  }, [onDone]);

  const emoji = EFFECT_EMOJI[effect];
  const rising = effect === "balloons" || effect === "hearts";

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            left: `${p.left}%`,
            [rising ? "bottom" : "top"]: "-10%",
            fontSize: p.size,
            animation: `${rising ? "samva-effect-rise" : "samva-effect-fall"} ${p.duration}s ease-in ${p.delay}s 1 both`,
            // @ts-expect-error -- custom property read by the keyframes below
            "--drift": `${p.drift}px`,
          }}
        >
          {emoji}
        </span>
      ))}
      <style>{`
        @keyframes samva-effect-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), 120vh) rotate(360deg); opacity: 0.2; }
        }
        @keyframes samva-effect-rise {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), -120vh) rotate(-20deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
