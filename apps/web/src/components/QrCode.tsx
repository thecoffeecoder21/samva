"use client";

import * as React from "react";
import QRCode from "qrcode";

// Takes a site-relative `path` rather than a full URL — resolving
// `window.location.origin` has to happen inside this draw effect (an
// "update the DOM/canvas" effect, not a setState-in-effect) rather than in
// the caller's render body, since `window` doesn't exist during SSR.
export function QrCode({ path, size = 176 }: { path: string; size?: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;
    const value = `${window.location.origin}${path}`;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#14161b", light: "#ffffff" },
    }).catch(() => {});
  }, [path, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label="QR code linking to this profile"
      className="rounded-(--radius-md) border border-(--color-border)"
    />
  );
}
