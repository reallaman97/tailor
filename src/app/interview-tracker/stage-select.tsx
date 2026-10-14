"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrackerStageAction } from "./actions";
import { TRACKER_STAGES } from "@/lib/interview-tracker/stages";
import { STATUS_LABEL } from "@/lib/resume-status";
import { Select } from "@/components/ui/select";
import type { ResumeStatus } from "@/generated/prisma/client";

/**
 * Moves an application to an interview stage — or closes it (Offer / Fail /
 * Canceled). For an application not tracked yet (`current` null), picking a
 * stage starts tracking it.
 */
export function StageSelect({ resumeId, current }: { resumeId: string; current: ResumeStatus | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Interview stage"
        value={current && TRACKER_STAGES.includes(current) ? current : ""}
        disabled={pending}
        className="h-9 min-w-[10rem] text-sm"
        onChange={(e) => {
          const stage = e.target.value;
          if (!stage) return;
          setError(null);
          startTransition(async () => {
            const result = await setTrackerStageAction(resumeId, stage);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
      >
        <option value="" disabled>
          {current ? "Move to…" : "Start tracking at…"}
        </option>
        {TRACKER_STAGES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
