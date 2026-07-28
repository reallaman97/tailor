"use client";

import { useState, useTransition } from "react";
import { setStatusAction } from "./actions";
import { Select } from "@/components/ui/select";
import type { Option } from "@/app/interview/interview-fields";

/**
 * Inline status changer. Available to the assigned Caller as well as
 * managers — the server action re-checks that the caller owns the interview.
 */
export function StatusControl({
  interviewId,
  currentStatusId,
  statuses,
}: {
  interviewId: string;
  currentStatusId: string | null;
  statuses: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Status"
        defaultValue={currentStatusId ?? ""}
        disabled={pending}
        className="h-8 w-44 text-sm"
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          startTransition(async () => {
            const result = await setStatusAction(interviewId, value);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <option value="">No status</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
