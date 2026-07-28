"use client";

import { useState, useTransition } from "react";
import { assignCallerAction } from "./actions";
import { Select } from "@/components/ui/select";
import type { Option } from "@/app/interview/interview-fields";

/** Manager-only: assign or unassign the Caller for this interview. */
export function CallerControl({
  interviewId,
  currentCallerId,
  callers,
}: {
  interviewId: string;
  currentCallerId: string | null;
  callers: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Assigned caller"
        defaultValue={currentCallerId ?? ""}
        disabled={pending}
        className="h-8 w-44 text-sm"
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          startTransition(async () => {
            const result = await assignCallerAction(interviewId, value);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <option value="">Unassigned</option>
        {callers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
