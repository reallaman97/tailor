"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Summary = { processed: number; updates: number; attention: number };

/**
 * Reads new mail for one profile. The server takes a batch at a time (each
 * email may need an AI call), so this keeps asking until nothing is left.
 */
export function CheckNowButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const total: Summary = { processed: 0, updates: 0, attention: 0 };
    setProgress(total);
    try {
      for (let round = 0; round < 50; round++) {
        const res = await fetch(`/api/inbox/${encodeURIComponent(profileId)}/check`, { method: "POST" });
        const data = (await res.json().catch(() => null)) as (Summary & { remaining: number; error?: string }) | null;
        if (!res.ok || !data) {
          setError(data?.error ?? "Couldn't check the mailbox — try again.");
          break;
        }
        total.processed += data.processed;
        total.updates += data.updates;
        total.attention += data.attention;
        setProgress({ ...total });
        router.refresh();
        if (data.remaining <= 0) break;
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} loading={running}>
          {running ? "Checking…" : "Check now"}
        </Button>
        {progress && (
          <span className="text-sm text-muted-foreground">
            {running ? "Reading new mail — " : "Done — "}
            {progress.processed} email{progress.processed === 1 ? "" : "s"} read, {progress.updates} tracker update
            {progress.updates === 1 ? "" : "s"}, {progress.attention} need{progress.attention === 1 ? "s" : ""} attention
          </span>
        )}
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
