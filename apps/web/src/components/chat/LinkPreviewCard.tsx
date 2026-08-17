import { ExternalLink } from "lucide-react";
import { cn } from "@samva/ui";
import type { LinkPreview } from "@samva/types";

export function LinkPreviewCard({ preview, isOwn }: { preview: LinkPreview; isOwn: boolean }) {
  let hostname = preview.url;
  try {
    hostname = new URL(preview.url).hostname.replace(/^www\./, "");
  } catch {
    // Keep the raw URL as a fallback label.
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mb-1.5 flex flex-col overflow-hidden rounded-(--radius-md) border",
        isOwn ? "border-white/30" : "border-(--color-border)",
      )}
    >
      {preview.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external, unregistered domains; next/image would need per-domain allowlisting
        <img src={preview.imageUrl} alt="" className="h-32 w-full object-cover" />
      )}
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-70">
          <ExternalLink size={10} />
          {preview.siteName || hostname}
        </span>
        {preview.title && <span className="text-sm font-medium">{preview.title}</span>}
        {preview.description && <span className="line-clamp-2 text-xs opacity-80">{preview.description}</span>}
      </div>
    </a>
  );
}
