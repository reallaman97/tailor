"use client";

import { useState, useTransition } from "react";
import type { BaseResumeImport } from "@/lib/base-resume/schema";
import { MAX_BASE_RESUME_BYTES } from "@/lib/base-resume/text";
import { useElapsedSeconds } from "@/lib/use-elapsed-seconds";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { UploadIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

/**
 * Step 1 of adding (or replacing) a base resume: choose/drop a file or paste
 * the text, then have it analyzed. Hands the parsed result to `onParsed`.
 */
export function ResumeUpload({
  onParsed,
  onCancel,
}: {
  onParsed: (result: BaseResumeImport) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();

  function choose(next: File | null) {
    setError(null);
    if (next && next.size > MAX_BASE_RESUME_BYTES) {
      setFile(null);
      setError("That file is too large (max 4MB).");
      return;
    }
    setFile(next);
  }

  function analyze() {
    setError(null);
    const body = new FormData();
    if (mode === "file") {
      if (!file) return setError("Choose a PDF, DOCX, or TXT file.");
      body.set("file", file);
    } else {
      if (!pasted.trim()) return setError("Paste the resume text first.");
      body.set("text", pasted);
    }
    startParse(async () => {
      try {
        const res = await fetch("/api/admin/base-resume", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as (BaseResumeImport & { error?: string }) | null;
        if (!res.ok || !data || data.error) {
          setError(data?.error ?? "Couldn't analyze the resume — try again.");
          return;
        }
        onParsed(data);
      } catch {
        setError("Couldn't reach the server — check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Resume source">
        <Button
          size="sm"
          variant={mode === "file" ? "secondary" : "ghost"}
          role="tab"
          aria-selected={mode === "file"}
          onClick={() => setMode("file")}
          disabled={parsing}
        >
          Upload file
        </Button>
        <Button
          size="sm"
          variant={mode === "text" ? "secondary" : "ghost"}
          role="tab"
          aria-selected={mode === "text"}
          onClick={() => setMode("text")}
          disabled={parsing}
        >
          Paste text
        </Button>
      </div>

      {mode === "file" ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40",
            dragging && "border-primary bg-primary/5"
          )}
        >
          <UploadIcon className="size-6 text-muted-foreground" />
          {file ? (
            <span className="text-sm font-medium text-foreground">{file.name}</span>
          ) : (
            <span className="text-sm text-foreground">Drop the resume here, or click to choose a file</span>
          )}
          <span className="text-xs text-muted-foreground">
            PDF, DOCX, or TXT · up to 4MB · scanned-image PDFs can&apos;t be read — paste the text instead
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            disabled={parsing}
          />
        </label>
      ) : (
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={14}
          placeholder="Paste the candidate's complete resume — every role and bullet"
          className="font-mono text-xs"
          aria-label="Resume text"
          disabled={parsing}
        />
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={analyze} loading={parsing}>
          {parsing ? <AnalyzingLabel /> : "Analyze resume"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={parsing}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function AnalyzingLabel() {
  const seconds = useElapsedSeconds();
  return <>Analyzing resume… {seconds}s</>;
}
