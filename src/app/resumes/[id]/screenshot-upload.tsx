"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useTransition } from "react";
import { uploadScreenshotAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { UploadIcon, CheckCircleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
// The server accepts up to 4.5MB; stay under it with headroom for the request envelope.
const TARGET_BYTES = 4 * 1024 * 1024;
const MAX_EDGE_PX = 2400;

/**
 * Full-page screenshots are often far larger than needed. If an image is over
 * the upload budget, re-encode it as JPEG (scaled so its longest edge is at
 * most MAX_EDGE_PX) — readable for review, and it always fits.
 */
async function fitForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) {
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    }
  }
  return file; // let the server report it as too large
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Proof-of-application upload. Choosing, dropping, or pasting (Ctrl+V) an
 * image shows a preview with its name and size before it's uploaded, so it's
 * always clear what will be sent.
 */
export function ScreenshotUpload({
  resumeId,
  hasScreenshot: initiallyUploaded,
  capturePaste = false,
  onUploaded,
}: {
  resumeId: string;
  hasScreenshot: boolean;
  /** Listen for Ctrl+V anywhere on the page (use where this is the page's only uploader). */
  capturePaste?: boolean;
  onUploaded?: () => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(initiallyUploaded);
  // Bumped after each upload so the shown image isn't a stale cached copy.
  const [version, setVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startUpload] = useTransition();
  // The live preview object URL, so it can be released when replaced or on unmount.
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  function choose(next: File | null | undefined) {
    setError(null);
    setSuccess(false);
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      setError("That isn't a PNG, JPEG, or WEBP image.");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  /** Swaps the preview object URL, releasing the previous one. */
  function setPreviewUrl(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  // Always sees the latest `choose` without re-subscribing the listener.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null;
    // Don't hijack pastes into text fields (cover letter, questions…).
    if (target?.closest("input, textarea, [contenteditable='true']")) return;
    const image = Array.from(e.clipboardData?.items ?? [])
      .find((item) => item.kind === "file" && ACCEPTED.includes(item.type))
      ?.getAsFile();
    if (image) {
      e.preventDefault();
      choose(new File([image], `pasted-screenshot.${image.type.split("/")[1]}`, { type: image.type }));
    }
  });

  useEffect(() => {
    if (!capturePaste) return;
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [capturePaste]);

  function clearSelection() {
    setFile(null);
    setPreviewUrl(null);
  }

  function upload() {
    if (!file) return;
    setError(null);
    startUpload(async () => {
      try {
        const body = new FormData();
        body.set("screenshot", await fitForUpload(file));
        const result = await uploadScreenshotAction(resumeId, undefined, body);
        if (result?.error) return setError(result.error);
        clearSelection();
        setUploaded(true);
        setVersion(Date.now());
        setSuccess(true);
        onUploaded?.();
      } catch {
        setError("Upload failed — check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {uploaded && !file && (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated, per-application binary served from our own route, not a static/optimizable asset
        <img
          src={`/api/resumes/${resumeId}/screenshot${version ? `?v=${version}` : ""}`}
          alt="Uploaded proof of application"
          className="max-h-72 w-auto self-start rounded-md border border-border object-contain"
        />
      )}

      {file && preview ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of the chosen file */}
          <img src={preview} alt="Selected screenshot" className="max-h-72 w-auto self-start rounded border border-border object-contain" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <CheckCircleIcon className="size-4 text-primary" />
            <span className="font-medium text-foreground">{file.name}</span>
            <span className="text-muted-foreground">{formatSize(file.size)}</span>
            <button type="button" onClick={clearSelection} className="text-primary hover:underline" disabled={pending}>
              Choose a different image
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40",
            dragging && "border-primary bg-primary/5"
          )}
        >
          <span className="flex items-center gap-2 text-foreground">
            <UploadIcon className="size-4" />
            {uploaded ? "Replace the screenshot" : "Choose a screenshot showing you applied"}
          </span>
          <span className="text-xs">
            Click, drop an image here{capturePaste ? ", or paste it with Ctrl+V" : ""} · PNG, JPEG, or WEBP
          </span>
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = ""; // allow re-choosing the same file
            }}
          />
        </label>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">Uploaded — this application is now pending admin approval.</Alert>}

      {file && (
        <Button size="sm" onClick={upload} loading={pending} className="self-start">
          {pending ? "Uploading…" : uploaded ? "Upload replacement" : "Upload screenshot"}
        </Button>
      )}
    </div>
  );
}
