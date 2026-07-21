import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon, LockIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools";

type ToolCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  status: ToolStatus;
  /** Required (and only used) when status is "open". */
  href?: string;
};

/**
 * One tile in the Cute Job Platform hub. Every tool is always shown — never
 * hidden by role — but only "open" tiles are clickable:
 * - open: this role can use it, and it's built.
 * - restricted: it's built, but this role isn't allowed to use it.
 * - coming-soon: not built yet, for anyone.
 */
export function ToolCard({ icon: Icon, name, description, status, href }: ToolCardProps) {
  const isOpen = status === "open";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" />
        </div>
        {status === "restricted" && (
          <Badge variant="outline" className="gap-1">
            <LockIcon className="size-3" />
            Restricted
          </Badge>
        )}
        {status === "coming-soon" && <Badge variant="outline">Coming soon</Badge>}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {status === "open" && description}
          {status === "restricted" && "Not available for your role."}
          {status === "coming-soon" && `${name} would be released soon..`}
        </p>
      </div>
    </>
  );

  if (isOpen && href) {
    return (
      <Link
        href={href}
        className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        {body}
        <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
          Open
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <div className="flex cursor-not-allowed flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/20 p-6 opacity-75">
      {body}
    </div>
  );
}
