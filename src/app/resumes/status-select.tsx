"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateResumeStatusAction } from "./actions";
import { StatusBadges } from "@/components/status-badges";
import { STATUS_OPTIONS, INTERVIEW_STATUSES } from "@/lib/resume-status";
import { ChevronDownIcon } from "@/components/icons";
import type { ResumeStatus } from "@/generated/prisma/client";

const GAP = 4;
// The checklist always renders the same fixed set of rows, so its height is
// predictable enough to flip against without needing to measure the actual
// DOM node after it mounts.
const ESTIMATED_PANEL_HEIGHT = STATUS_OPTIONS.length * 32 + 16;

/**
 * An application can hold several simultaneous statuses at once (e.g.
 * Applied+Reply+Tech1 — every stage reached so far, not just the current
 * one). Checking a new box adds it to the set; unchecking removes it —
 * superadmin-only, since only they may change status.
 *
 * The checklist panel is rendered via a portal into document.body rather
 * than as a normal descendant: table cells clip overflow (needed for the
 * resizable-column layout), which was cutting the panel down to nothing
 * when nested inside one.
 */
export function StatusMultiSelect({
  resumeId,
  statuses,
  onSchedule,
}: {
  resumeId: string;
  statuses: ResumeStatus[];
  /** Called when an interview-stage status (Intro/Tech/Final) is newly added — used to prompt scheduling an interview. */
  onSchedule?: (status: ResumeStatus) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Flips the panel above the trigger instead of below when there isn't enough room beneath it (e.g. the last row of a long table). */
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

  useLayoutEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    // The panel is fixed-position (portaled out of the table's clipped
    // cells), so it doesn't move on its own when the page — or the table's
    // own scroll container — scrolls. Re-anchor (and re-flip) it to the
    // trigger instead of letting it drift away from the row.
    function reposition() {
      setCoords(computeCoords());
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function toggleOpen() {
    if (!open) setCoords(computeCoords());
    setOpen((prev) => !prev);
  }

  function toggleStatus(value: ResumeStatus) {
    const adding = !statuses.includes(value);
    const next = adding ? [...statuses, value] : statuses.filter((s) => s !== value);
    if (next.length === 0) return; // at least one status is required
    startTransition(() => updateResumeStatusAction(resumeId, next));
    // Adding an interview stage is the "an interview is scheduled" signal — prompt to create one.
    if (adding && onSchedule && INTERVIEW_STATUSES.has(value)) {
      setOpen(false);
      onSchedule(value);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="flex min-w-[10rem] cursor-pointer items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 text-sm hover:bg-muted"
        aria-label="Application statuses"
      >
        <span className="min-w-0 flex-1">
          <StatusBadges statuses={statuses} nowrap />
        </span>
        <ChevronDownIcon className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 flex w-44 flex-col gap-0.5 rounded-md border border-border bg-card p-1.5 shadow-lg"
          >
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-foreground hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={statuses.includes(opt.value)}
                  disabled={pending}
                  onChange={() => toggleStatus(opt.value)}
                  className="size-3.5 accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
