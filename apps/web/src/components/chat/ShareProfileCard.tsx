"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@samva/ui";
import { QrCode } from "@/components/QrCode";

export function ShareProfileCard({ username }: { username: string }) {
  const [copied, setCopied] = React.useState(false);
  const path = `/u/${username}`;

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <QrCode path={path} />
      <Button variant="secondary" onClick={copyLink}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Link copied" : "Copy profile link"}
      </Button>
    </div>
  );
}
