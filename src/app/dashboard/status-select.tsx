"use client";

import { useTransition } from "react";
import { updateResumeStatusAction } from "./actions";
import type { ResumeStatus } from "@/generated/prisma/client";

const STATUS_OPTIONS: { value: ResumeStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "GENERATED", label: "Generated" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
];

export function StatusSelect({
  resumeId,
  status,
}: {
  resumeId: string;
  status: ResumeStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateResumeStatusAction(resumeId, e.target.value))}
      className="rounded border px-2 py-1 text-sm disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
