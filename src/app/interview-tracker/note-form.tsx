"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { UploadIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
// The server takes up to 4MB; it compresses again on arrival.
const TARGET_BYTES = 3.5 * 1024 * 1024;
const MAX_EDGE_PX = 2400;

/** Shrinks a very large screenshot in the browser so it fits the upload limit. */
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
    if (blob && blob.size <= TARGET_BYTES) return new File([blob], "screenshot.jpg", { type: "image/jpeg" });
  }
  return file;
}

/**
 * Adds a note to an application's interview history: what happened, and/or a
 * screenshot of the meeting (to remember who the interviewers were). Images
 * can be chosen, dropped, or pasted with Ctrl+V anywhere on the page.
 */
export function NoteForm({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const inputId = useId();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  function setPreviewUrl(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  function choose(next: File | null | undefined) {
    setError(null);
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) return setError("That isn't a PNG, JPEG, or WEBP image.");
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function clearImage() {
    setFile(null);
    setPreviewUrl(null);
  }

  // Always sees the latest `choose` without re-subscribing the listener.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const image = [...(e.clipboardData?.files ?? [])].find((f) => ACCEPTED.includes(f.type));
    if (!image) return; // plain text pastes into the comment as usual
    e.preventDefault();
    choose(new File([image], `pasted.${image.type.split("/")[1]}`, { type: image.type }));
  });
  useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);

  function submit() {
    if (!body.trim() && !file) return setError("Write a comment or add a screenshot.");
    setError(null);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("body", body);
        if (file) form.set("image", await fitForUpload(file));
        const res = await fetch(`/api/interview-tracker/${encodeURIComponent(resumeId)}/notes`, {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) return setError(data?.error ?? "Couldn't save the note — try again.");
        setBody("");
        clearImage();
        router.refresh();
      } catch {
        setError("Couldn't reach the server — check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !pending) submit();
        }}
        rows={4}
        maxLength={5000}
        placeholder="How did it go? Who did you meet, what did they ask, what's the next step…"
        aria-label="Note"
      />

      {file && preview ? (
        <div className="flex items-start gap-3 rounded-lg border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of the chosen file */}
          <img src={preview} alt="Screenshot to attach" className="max-h-40 w-auto rounded object-contain" />
          <button
            type="button"
            onClick={clearImage}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Remove screenshot"
            disabled={pending}
          >
            <XIcon className="size-4" />
          </button>
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
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40",
            dragging && "border-primary bg-primary/5"
          )}
        >
          <UploadIcon className="size-4 shrink-0" />
          Add a meeting screenshot (optional) — click, drop, or paste with Ctrl+V
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} loading={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
        <span className="text-xs text-muted-foreground">Ctrl+Enter to save</span>
      </div>
    </div>
  );
}
