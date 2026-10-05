import Link from "next/link";
import { cn } from "@/lib/utils";

// The Applications lists load a recent window rather than every application
// ever made: each load is a database read, and at thousands of applications a
// month an unbounded list would grow without limit (and with it the database
// egress). Older applications are one click away.
export const LIST_RANGES = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
] as const;

export type ListRange = (typeof LIST_RANGES)[number];

/** The chosen range from `?range=`, falling back to `defaultValue`. */
export function resolveListRange(param: string | undefined, defaultValue: ListRange["value"]): {
  range: ListRange;
  since: Date | undefined;
} {
  const range = LIST_RANGES.find((r) => r.value === param) ?? LIST_RANGES.find((r) => r.value === defaultValue)!;
  return { range, since: range.days === null ? undefined : new Date(Date.now() - range.days * 24 * 60 * 60 * 1000) };
}

export function ListRangeTabs({ current }: { current: ListRange["value"] }) {
  return (
    <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-lg border border-border p-1 text-sm">
      {LIST_RANGES.map((r) => (
        <Link
          key={r.value}
          href={`/resumes?range=${r.value}`}
          aria-current={r.value === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1",
            r.value === current ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
