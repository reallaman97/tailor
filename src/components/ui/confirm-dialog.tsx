"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

function ConfirmSubmitButton({
  confirmLabel,
  variant,
}: {
  confirmLabel: string;
  variant: ButtonProps["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending}>
      {pending ? "Working…" : confirmLabel}
    </Button>
  );
}

/**
 * Confirmation modal built on the native <dialog> element — real focus
 * trapping and ESC-to-close from the browser, no dependency needed.
 *
 * Renders its own trigger button (rather than accepting one via a render
 * prop) so the ref-opening callback is always attached as a plain inline
 * onClick — the one pattern React's ref-usage lint rule can verify is safe.
 */
export function ConfirmDialog({
  triggerContent,
  triggerVariant = "ghost",
  triggerSize = "sm",
  triggerClassName,
  triggerLabel,
  title,
  description,
  confirmLabel = "Delete",
  confirmVariant = "destructive",
  dismissLabel = "Cancel",
  action,
}: {
  triggerContent: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  triggerLabel?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  /** The button that closes the dialog without acting. */
  dismissLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-label={triggerLabel}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerContent}
      </Button>
      <dialog
        ref={dialogRef}
        style={{ width: "calc(100vw - 2rem)", maxWidth: "28rem" }}
        className="m-auto box-border rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex min-w-0 flex-col gap-2 p-6">
          <h3
            className="text-base font-semibold"
            style={{ overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}
          >
            {title}
          </h3>
          <p
            className="text-sm text-muted-foreground"
            style={{ overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}
          >
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border p-4">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {dismissLabel}
          </Button>
          <form action={action}>
            <ConfirmSubmitButton confirmLabel={confirmLabel} variant={confirmVariant} />
          </form>
        </div>
      </dialog>
    </>
  );
}
