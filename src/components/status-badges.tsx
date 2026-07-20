import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/lib/resume-status";
import type { ResumeStatus } from "@/generated/prisma/client";

/** Read-only display of every status an application has reached — normal users can see but not edit this. */
export function StatusBadges({ statuses }: { statuses: ResumeStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((s) => (
        <Badge key={s} variant={STATUS_BADGE_VARIANT[s]}>
          {STATUS_LABEL[s]}
        </Badge>
      ))}
    </div>
  );
}
