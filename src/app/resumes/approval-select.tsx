"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateResumeApprovalAction } from "./actions";
import { Select } from "@/components/ui/select";
import { APPROVAL_STATUS_LABEL } from "@/lib/resume-status";
import type { ApprovalStatus } from "@/generated/prisma/client";

const APPROVAL_OPTIONS: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];

const GAP = 8;
// Worst case is the screenshot preview (max-h-48 = 192px) plus the panel's
// own padding — stable enough to flip against without measuring the DOM.
const ESTIMATED_PANEL_HEIGHT = 210;

/**
 * Superadmin-only inline approval change, like SourceSelect — plus a link to
 * the uploaded screenshot that previews it on hover (portaled into
 * document.body: table cells clip overflow for the resizable-column layout,
 * which cuts an ordinary descendant popover down to an invisible sliver).
 */
export function ApprovalSelect({
  resumeId,
  approvalStatus,
  hasScreenshot,
}: {
  resumeId: string;
  approvalStatus: ApprovalStatus;
  hasScreenshot: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);

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
    <div className="flex items-center gap-1.5">
      <Select
        value={approvalStatus}
        disabled={pending}
        onChange={(e) => startTransition(() => updateResumeApprovalAction(resumeId, e.target.value))}
        className="h-8 min-w-[7.5rem] text-sm"
        aria-label="Approval status"
      >
        {APPROVAL_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {APPROVAL_STATUS_LABEL[value]}
          </option>
        ))}
      </Select>
      {hasScreenshot ? (
        <a
          ref={triggerRef}
          href={`/resumes/${resumeId}/screenshot`}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={handleEnter}
          onMouseLeave={() => setOpen(false)}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          View
        </a>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">Empty</span>
      )}
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 w-56 rounded-md border border-border bg-card p-2 shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, per-application binary served from our own route, not a static/optimizable asset */}
            <img
              src={`/resumes/${resumeId}/screenshot`}
              alt="Uploaded proof of application"
              className="max-h-48 w-full rounded object-contain"
            />
          </div>,
          document.body
        )}
    </div>
  );
}
