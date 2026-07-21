// Pure constants/labels only — no server-only imports (db, crypto, etc.) —
// so client components (e.g. the Work History admin form) can import this
// safely. work-history.ts itself pulls in the Postgres driver, which breaks
// the browser bundle if a client component imports anything from it besides
// types (an earlier bug: importing WORKING_STYLE_OPTIONS as a value from
// work-history.ts dragged db.ts, and therefore `pg`, into the client bundle).
import type { WorkingStyle, WorkingType } from "@/generated/prisma/client";

export const WORKING_STYLE_OPTIONS: { value: WorkingStyle; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
];

export const WORKING_STYLE_LABEL: Record<WorkingStyle, string> = Object.fromEntries(
  WORKING_STYLE_OPTIONS.map((o) => [o.value, o.label])
) as Record<WorkingStyle, string>;

export const WORKING_TYPE_OPTIONS: { value: WorkingType; label: string }[] = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-site" },
];

export const WORKING_TYPE_LABEL: Record<WorkingType, string> = Object.fromEntries(
  WORKING_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<WorkingType, string>;
