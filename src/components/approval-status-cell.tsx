"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { APPROVAL_STATUS_LABEL, APPROVAL_BADGE_VARIANT } from "@/lib/resume-status";
import type { ApprovalStatus } from "@/generated/prisma/client";

const GAP = 8;
// Worst case is the screenshot preview (max-h-48 = 192px) plus the panel's
// own padding — stable enough to flip against without measuring the DOM.
const ESTIMATED_PANEL_HEIGHT = 210;

/**
 * Always shows the real approval status (Pending/Approved/Rejected) — an
 * application with no uploaded screenshot just appends "(Empty)" so it still
 * reads as a real status, not a 4th pseudo-value.
 *
 * The preview popover is rendered via a portal into document.body rather
 * than as a normal descendant: table cells clip overflow (needed for the
 * resizable-column layout), which was silently cutting the popover down to
 * an invisible sliver when nested inside one.
 */
export function ApprovalStatusCell({
  resumeId,
  approvalStatus,
  hasScreenshot,
}: {
  resumeId: string;
  approvalStatus: ApprovalStatus;
  hasScreenshot: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const label = hasScreenshot
    ? APPROVAL_STATUS_LABEL[approvalStatus]
    : `${APPROVAL_STATUS_LABEL[approvalStatus]} (Empty)`;

  /** Flips the popover above the trigger instead of below when there isn't enough room beneath it (e.g. the last row of a long table). */
  function computeCoords(): { top: number; left: number } | null {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return null;

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const shouldFlipUp = spaceBelow < ESTIMATED_PANEL_HEIGHT + GAP && spaceAbove > spaceBelow;

    return {
      top: shouldFlipUp ? triggerRect.top - ESTIMATED_PANEL_HEIGHT - GAP : triggerRect.bottom + GAP,
      left: triggerRect.left,
    };
  }

  function handleEnter() {
    setCoords(computeCoords());
    setOpen(true);
  }

  // The popover is fixed-position (portaled out of the table's clipped
  // cells), so re-anchor (and re-flip) it to the trigger on scroll —
  // otherwise it's left floating in place while the row scrolls away.
  useLayoutEffect(() => {
    if (!open) return;

    function reposition() {
      setCoords(computeCoords());
    }

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="inline-block" onMouseEnter={handleEnter} onMouseLeave={() => setOpen(false)}>
      <Badge variant={APPROVAL_BADGE_VARIANT[approvalStatus]}>{label}</Badge>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 w-56 rounded-md border border-border bg-card p-2 shadow-lg"
          >
            {hasScreenshot ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated, per-application binary served from our own route, not a static/optimizable asset
              <img
                src={`/resumes/${resumeId}/screenshot`}
                alt="Uploaded proof of application"
                className="max-h-48 w-full rounded object-contain"
              />
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">No screenshot uploaded</p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
