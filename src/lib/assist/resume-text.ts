import type { ResumeDocument } from "@/lib/export/build-document";

function period(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  return `${start ?? "?"} – ${end ?? "Present"}`;
}

/**
 * The submitted (tailored) resume as plain text — what the cover letter and
 * application answers must stay consistent with, since it's what the employer
 * reads. Contact email and phone are deliberately left out: they're never sent
 * to the AI provider (the name and city are enough for a signature/context).
 * Bold markers (**…**) from older generations are stripped.
 */
export function resumeToText(doc: ResumeDocument): string {
  const clean = (s: string) => s.replace(/\*\*/g, "");
  const lines: string[] = [doc.fullName];
  if (doc.headline) lines.push(clean(doc.headline));
  const location = [doc.city, doc.state].filter(Boolean).join(", ");
  if (location) lines.push(location);

  if (doc.summary) lines.push("", "SUMMARY", clean(doc.summary));

  if (doc.skills.length > 0) {
    lines.push("", "SKILLS");
    for (const group of doc.skills) lines.push(`${group.category}: ${group.skills.join(", ")}`);
  }

  if (doc.workHistory.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const w of doc.workHistory) {
      lines.push(
        "",
        `${w.jobTitle} — ${w.company}${w.location ? ` (${w.location})` : ""} | ${period(w.startDate, w.endDate)}`
      );
      for (const b of w.bullets) lines.push(`- ${clean(b)}`);
    }
  }

  if (doc.education.length > 0) {
    lines.push("", "EDUCATION");
    for (const e of doc.education) {
      const when = period(e.startDate, e.endDate);
      lines.push(`${e.degree}${e.field ? `, ${e.field}` : ""} — ${e.institution}${when ? ` | ${when}` : ""}`);
    }
  }

  if (doc.certifications.length > 0) {
    lines.push("", "CERTIFICATIONS");
    for (const c of doc.certifications) lines.push(`${c.name}${c.issuer ? ` — ${c.issuer}` : ""}${c.issueDate ? ` (${c.issueDate})` : ""}`);
  }

  return lines.join("\n");
}
