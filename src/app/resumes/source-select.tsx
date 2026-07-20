"use client";

import { useTransition } from "react";
import { updateResumeSourceAction } from "./actions";
import { Select } from "@/components/ui/select";
import { SOURCE_OPTIONS } from "@/lib/resume-status";
import type { ApplicationSource } from "@/generated/prisma/client";

export function SourceSelect({
  resumeId,
  source,
}: {
  resumeId: string;
  source: ApplicationSource;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={source}
      disabled={pending}
      onChange={(e) => startTransition(() => updateResumeSourceAction(resumeId, e.target.value))}
      className="h-8 min-w-[8.5rem] text-sm"
      aria-label="Application source"
    >
      {SOURCE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
