"use client";

import { upload } from "@vercel/blob/client";
import type { MessageAttachment, MessageType } from "@samva/types";

export type AttachmentKind = "image" | "video" | "audio" | "document";

const KIND_BY_MIME: Array<{ test: (mime: string) => boolean; kind: AttachmentKind; type: MessageType }> = [
  { test: (m) => m.startsWith("image/"), kind: "image", type: "image" },
  { test: (m) => m.startsWith("video/"), kind: "video", type: "video" },
  { test: (m) => m.startsWith("audio/"), kind: "audio", type: "audio" },
  { test: () => true, kind: "document", type: "document" },
];

export function classifyFile(mimeType: string) {
  return KIND_BY_MIME.find((entry) => entry.test(mimeType))!;
}

export async function uploadAttachment(
  file: File | Blob,
  fileName: string,
  conversationId: string,
  kind: AttachmentKind,
  onUploadProgress?: (percentage: number) => void,
  contentTypeOverride?: string,
): Promise<MessageAttachment> {
  const blob = await upload(fileName, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: JSON.stringify({ conversationId, kind }),
    onUploadProgress: onUploadProgress ? ({ percentage }) => onUploadProgress(percentage) : undefined,
    // MediaRecorder's Blob.type is unreliable across browsers for audio-only
    // webm captures (Chromium has reported it as "video/webm" in practice),
    // so voice notes pass the mimeType actually used to start the recorder
    // instead of trusting the blob's own type.
    contentType: contentTypeOverride,
  });

  let width: number | null = null;
  let height: number | null = null;
  if (kind === "image" && typeof window !== "undefined") {
    const dims = await readImageDimensions(file).catch(() => null);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  }

  return {
    id: blob.pathname,
    url: blob.url,
    mimeType: contentTypeOverride ?? blob.contentType,
    fileName,
    sizeBytes: file instanceof File ? file.size : null,
    width,
    height,
    durationMs: null,
  };
}

function readImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions"));
    };
    img.src = url;
  });
}
