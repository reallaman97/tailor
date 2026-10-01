import type { ValidationReport } from "@/lib/tailoring/schema";
import { cn } from "@/lib/utils";

/**
 * The model's self-check for a generated resume. Admin-only: render this only
 * behind a team-admin check (it's never shown to bidders or put in the PDF).
 */
export function ValidationReportPanel({ report }: { report: ValidationReport }) {
  // Higher ATS match is better; lower AI probability is better.
  const atsTone = report.atsMatchScore >= 85 ? "good" : report.atsMatchScore >= 70 ? "fair" : "poor";
  const aiTone = report.aiProbability <= 20 ? "good" : report.aiProbability <= 40 ? "fair" : "poor";

  const checks = [
    { label: "Research / study / analysis", text: report.researchContributionCheck },
    { label: "Evidence placement", text: report.evidencePlacementCheck },
    { label: "Title realism", text: report.titleRealismCheck },
  ].filter((c) => c.text);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Score label="ATS match (estimate)" value={report.atsMatchScore} tone={atsTone} />
        <Score label="AI probability (estimate)" value={report.aiProbability} tone={aiTone} />
      </div>

      {checks.length > 0 && (
        <dl className="flex flex-col gap-3">
          {checks.map((c) => (
            <div key={c.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{c.text}</dd>
            </div>
          ))}
        </dl>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gaps &amp; risks</h4>
        {report.gapsAndRisks.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
            {report.gapsAndRisks.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">None reported.</p>
        )}
      </div>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: "good" | "fair" | "poor" }) {
  return (
    <div
      className={cn(
        "min-w-40 rounded-md border px-4 py-2.5",
        tone === "good" && "border-success/30 bg-success/10",
        tone === "fair" && "border-warning/30 bg-warning/10",
        tone === "poor" && "border-destructive/30 bg-destructive/10"
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "fair" && "text-warning",
          tone === "poor" && "text-destructive"
        )}
      >
        {value}%
      </div>
    </div>
  );
}
