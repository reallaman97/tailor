"use client";

import { cn } from "@/lib/utils";
import { useElapsedSeconds } from "@/lib/use-elapsed-seconds";

// The phases the resume prompt works through. The model reports no progress
// mid-call, so these advance on elapsed time as an honest estimate of where a
// typical 60–110s generation is — the final step stays open until it finishes.
const STAGES: { at: number; label: string }[] = [
  { at: 0, label: "Reading the job description and the candidate's base resume" },
  { at: 8, label: "Realigning the career path and job titles" },
  { at: 25, label: "Aligning the latest roles to the job's stack" },
  { at: 45, label: "Rewriting experience bullets and skills" },
  { at: 75, label: "Auditing required-skill coverage and validating" },
];

const SLOW_AFTER_SECONDS = 150;

/** Stage-by-stage progress for an in-flight resume generation. Render while the build is pending. */
export function GenerationProgress({ active }: { active: boolean }) {
  // Mounting the panel per run restarts its timer from zero.
  return active ? <RunningPanel /> : null;
}

function RunningPanel() {
  const seconds = useElapsedSeconds();
  const current = STAGES.reduce((idx, stage, i) => (seconds >= stage.at ? i : idx), 0);
  // Approaches but never reaches 100% — completion is signalled by the result, not the bar.
  const percent = Math.min(95, Math.round((1 - Math.exp(-seconds / 40)) * 100));

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">Building your tailored resume…</span>
        <span className="tabular-nums text-muted-foreground">{formatElapsed(seconds)}</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${percent}%` }} />
      </div>

      <ol className="flex flex-col gap-1.5 text-sm">
        {STAGES.map((stage, i) => (
          <li
            key={stage.label}
            className={cn(
              "flex items-center gap-2",
              i < current && "text-muted-foreground",
              i === current && "font-medium text-foreground",
              i > current && "text-muted-foreground/60"
            )}
          >
            <span aria-hidden className="inline-flex w-4 justify-center">
              {i < current ? "✓" : i === current ? <Spinner /> : "·"}
            </span>
            {stage.label}
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        {seconds >= SLOW_AFTER_SECONDS
          ? "Taking longer than usual — still working. Please keep this tab open."
          : "This usually takes 1–2 minutes. Please keep this tab open."}
      </p>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
}

function formatElapsed(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
