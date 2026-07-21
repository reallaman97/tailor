import { STATUS_LABEL, STATUS_COLOR } from "@/lib/resume-status";
import { cn } from "@/lib/utils";
import type { ResumeStatus } from "@/generated/prisma/client";

/**
 * A single status chip in its own unique color.
 * - `dense` gives the vivid, glowing look used in table rows (opaque fill so
 *   chips can overlap cleanly, a colored ring, and a bright bold label).
 * - `abbreviated` (dense only) renders just the first letter in a circle — used
 *   for the earlier statuses so a long chain fits while the color still IDs each.
 */
export function StatusPill({
  status,
  abbreviated = false,
  dense = false,
}: {
  status: ResumeStatus;
  abbreviated?: boolean;
  dense?: boolean;
}) {
  const color = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];

  if (dense) {
    return (
      <span
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border bg-card font-semibold",
          abbreviated ? "size-5 text-[11px]" : "px-2 py-0.5 text-[11px]"
        )}
        style={{ color, borderColor: color, boxShadow: `inset 0 0 8px ${color}4d, 0 0 3px ${color}33` }}
      >
        {abbreviated ? label.charAt(0) : label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}22`, borderColor: `${color}55` }}
    >
      {label}
    </span>
  );
}

/**
 * Read-only display of every status an application has reached. With `nowrap`
 * (dense table rows) the chips overlap on a single line and every status but
 * the LAST is abbreviated to a colored first-letter circle, so the current
 * status shows in full while the history stays compact — identifiable by color.
 * A hover tooltip lists them all. Without `nowrap` every status shows in full.
 */
export function StatusBadges({ statuses, nowrap = false }: { statuses: ResumeStatus[]; nowrap?: boolean }) {
  if (!nowrap) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {statuses.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </div>
    );
  }

  const lastIndex = statuses.length - 1;
  return (
    <div
      className="flex min-w-0 flex-nowrap items-center overflow-hidden"
      title={statuses.map((s) => STATUS_LABEL[s]).join(", ")}
    >
      {statuses.map((s, i) => (
        // Negative margin overlaps the chips; later ones paint on top.
        <div key={s} className="shrink-0" style={i > 0 ? { marginLeft: -6 } : undefined}>
          <StatusPill status={s} abbreviated={i < lastIndex} dense />
        </div>
      ))}
    </div>
  );
}
