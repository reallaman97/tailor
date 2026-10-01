"use client";

import { useState, useTransition } from "react";
import { requestCoverLetter } from "./assist-client";
import { CopyButton } from "./copy-button";
import { useElapsedSeconds } from "@/lib/use-elapsed-seconds";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { DownloadIcon, SparklesIcon } from "@/components/icons";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * A short cover letter written from this application's tailored resume and job
 * description. The saved version is what "Generate" last produced; edits in the
 * box are for quick touch-ups before copying and aren't saved.
 */
export function CoverLetterCard({
  resumeId,
  fileBaseName,
  initial,
}: {
  resumeId: string;
  /** e.g. "Jordan-A-Miller-ShelfSense" — used for the downloaded .txt name. */
  fileBaseName: string;
  initial: { text: string; generatedAt: string } | null;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [generatedAt, setGeneratedAt] = useState(initial?.generatedAt ?? null);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startGenerate] = useTransition();

  function generate() {
    setError(null);
    startGenerate(async () => {
      try {
        const result = await requestCoverLetter(resumeId, instructions);
        if (result.error) return setError(result.error);
        setText(result.coverLetter ?? "");
        setGeneratedAt(result.generatedAt ?? null);
      } catch {
        setError("Couldn't reach the server — check your connection and try again.");
      }
    });
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBaseName}-cover-letter.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover letter</CardTitle>
        <CardDescription>
          A short, specific letter written from the tailored resume, so it matches what the employer reads.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {text ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.min(22, Math.max(10, text.split("\n").length + 2))}
              aria-label="Cover letter"
              className="text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {wordCount(text)} words
              {generatedAt && ` · generated ${new Date(generatedAt).toLocaleString()}`} · edits here are for quick
              touch-ups before copying and aren&apos;t saved.
            </p>
          </>
        ) : (
          !pending && <p className="text-sm text-muted-foreground">No cover letter yet.</p>
        )}

        {showInstructions ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`cover-instructions-${resumeId}`} className="text-sm font-medium text-foreground">
              Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id={`cover-instructions-${resumeId}`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Mention I'm open to relocating to Austin. Keep it under 180 words."
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="self-start text-sm text-primary hover:underline"
          >
            + Add instructions
          </button>
        )}

        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} loading={pending}>
            {pending ? <Elapsed label="Writing" /> : (
              <>
                <SparklesIcon className="size-4" />
                {text ? "Regenerate" : "Generate cover letter"}
              </>
            )}
          </Button>
          {text && !pending && (
            <>
              <CopyButton text={text} size="md" />
              <Button variant="outline" onClick={download}>
                <DownloadIcon className="size-4" />
                Download .txt
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Elapsed({ label }: { label: string }) {
  const seconds = useElapsedSeconds();
  return (
    <>
      {label}… {seconds}s
    </>
  );
}
