"use client";

import Link from "next/link";
import { GenerationProgress } from "./generation-progress";
import type { useResumeBuild } from "./use-resume-build";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * The resume builder form's footer, shared by the bidder and admin forms:
 * build progress (with Stop), the duplicate / error / stopped messages, and
 * the submit button.
 */
export function BuildFooter({
  build,
  duplicate,
}: {
  build: ReturnType<typeof useResumeBuild>;
  /** From useDuplicateCheck — blocks the build before any tokens are spent. */
  duplicate: { id: string; message: string } | null;
}) {
  const { phase, pending, outcome, stop } = build;

  return (
    <>
      <GenerationProgress
        active={pending}
        onStop={phase === "building" || phase === "stopping" ? stop : undefined}
        stopping={phase === "stopping"}
      />

      {!pending && duplicate && !outcome.builtId && (
        <Alert variant="destructive">
          {duplicate.message} <ContinueLink id={duplicate.id} />.
        </Alert>
      )}
      {!pending && outcome.error && (
        <Alert variant="destructive">
          {outcome.error}
          {outcome.duplicateId && (
            <>
              {" "}
              <ContinueLink id={outcome.duplicateId} />.
            </>
          )}
        </Alert>
      )}
      {!pending && outcome.stopped && (
        <Alert>
          Generation stopped. The application was marked <strong>Canceled</strong> — it stays in the tracker, but
          doesn&apos;t block another application to this company.
        </Alert>
      )}
      {!pending && outcome.builtId && <Alert variant="success">Resume built — opening its workstation…</Alert>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={Boolean(duplicate)}>
          {pending ? (phase === "creating" ? "Checking…" : "Building…") : outcome.error ? "Retry" : "Build resume"}
        </Button>
        {!pending && (
          <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Back to applications
          </Link>
        )}
      </div>
    </>
  );
}

function ContinueLink({ id }: { id: string }) {
  return (
    <Link href={`/resumes/new?app=${id}`} className="font-medium underline">
      Continue working on it
    </Link>
  );
}
