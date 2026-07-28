import { Fragment } from "react";
import { InterviewStatusPill } from "@/app/interview/status-pill";
import { CUSTOM_FIELD_DEFS, SECTION_LABELS } from "@/lib/interview/fields";
import { formatInterviewTime } from "@/lib/interview/timezone";
import type { InterviewDetail } from "@/lib/interview/interviews";

/**
 * Read-only detail view (used for Callers, who can't edit core fields). Server
 * component — pure display of the already-scoped InterviewDetail.
 */
export function InterviewReadView({ detail, timezone }: { detail: InterviewDetail; timezone: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title={SECTION_LABELS.job}>
        <Row label="Job Title" value={detail.jobTitle} />
        <Row label="Company" value={detail.companyName} />
        <Row label="Job Post Link">{detail.jobPostLink ? <ExtLink href={detail.jobPostLink} /> : "—"}</Row>
        <Row label="Salary Range" value={detail.salaryRange ?? "—"} />
        <Row label="Job Description" wide>
          <p className="whitespace-pre-wrap text-sm text-foreground">{detail.jobDescription || "—"}</p>
        </Row>
      </Section>

      <Section title={SECTION_LABELS.schedule}>
        <Row label="Time" value={detail.scheduledAt ? formatInterviewTime(detail.scheduledAt, timezone) : "—"} />
        <Row label="Interview Process" value={detail.stage?.label ?? "—"} />
        <Row label="Status">
          <InterviewStatusPill status={detail.status} />
        </Row>
        <Row label="Meeting Type" value={detail.meetingType?.label ?? "—"} />
        <Row label="Meeting Link">{detail.meetingLink ? <ExtLink href={detail.meetingLink} /> : "—"}</Row>
      </Section>

      <Section title={SECTION_LABELS.people}>
        <Row label="Caller" value={detail.caller?.name ?? "Unassigned"} />
        <Row label="Interviewer Info" wide>
          <p className="whitespace-pre-wrap text-sm text-foreground">{linkify(detail.interviewerInfo ?? "—")}</p>
        </Row>
      </Section>

      {CUSTOM_FIELD_DEFS.length > 0 && (
        <Section title={SECTION_LABELS.custom}>
          {CUSTOM_FIELD_DEFS.map((def) => (
            <Row key={def.key} label={def.label} value={String(detail.meta[def.key] ?? "—")} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  children,
  wide,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children ?? value}</dd>
    </div>
  );
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
      {href}
    </a>
  );
}

/** Turns bare URLs in free text into safe, clickable links (React nodes, no HTML injection). */
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
