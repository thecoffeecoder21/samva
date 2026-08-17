import "server-only";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const MAX_BYTES = 300_000;
const FETCH_TIMEOUT_MS = 5000;

export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_PATTERN);
  return match ? match[0].replace(/[.,;!?)]+$/, "") : null;
}

// Blocks the obvious SSRF targets (loopback, link-local, private ranges,
// bare hostnames) — not exhaustive DNS-rebinding protection, but enough to
// stop this preview fetcher from being used to probe internal services.
function isFetchableUrl(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || !host.includes(".")) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}

interface RawPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function parseOg(html: string, baseUrl: string): RawPreview {
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title = extractMeta(html, "og:title") ?? (titleTag ? decodeEntities(titleTag).trim() : null);
  const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");
  let imageUrl = extractMeta(html, "og:image");
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).toString();
    } catch {
      imageUrl = null;
    }
  }
  const siteName = extractMeta(html, "og:site_name");
  return { title, description, imageUrl, siteName };
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let result = "";
  let bytesRead = 0;
  while (bytesRead < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return result;
}

export async function fetchLinkPreview(rawUrl: string): Promise<RawPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isFetchableUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SamvaLinkPreview/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await readCapped(res);
    if (!html) return null;
    const preview = parseOg(html, url.toString());
    if (!preview.title && !preview.description && !preview.imageUrl) return null;
    return preview;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
