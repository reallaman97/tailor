"use client";

import { useState, useTransition } from "react";
import { assignProfileAction } from "./actions";
import { Select } from "@/components/ui/select";
import type { Option } from "@/app/interview/interview-fields";

/** Manager-only: set or change the candidate profile this interview is for. */
export function ProfileControl({
  interviewId,
  currentProfileId,
  profiles,
}: {
  interviewId: string;
  currentProfileId: string | null;
  profiles: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Candidate profile"
        defaultValue={currentProfileId ?? ""}
        disabled={pending}
        className="h-8 min-w-52 text-sm"
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          startTransition(async () => {
            const result = await assignProfileAction(interviewId, value);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <option value="">No candidate profile</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
