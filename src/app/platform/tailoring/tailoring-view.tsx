"use client";

import { useState, useTransition } from "react";
import { useElapsedSeconds } from "@/lib/use-elapsed-seconds";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ValidationReportPanel } from "@/components/validation-report";
import { RESUME_MODELS } from "@/lib/tailoring/models";
import type { ResumePromptFingerprint } from "@/lib/tailoring/resume-prompt";
import { runTailoringDebugAction, saveResumeModelAction } from "./actions";
import type { TailoringDebugResult } from "@/lib/tailoring/debug";

type CandidateEntry = { id: string; jobTitle?: string; company?: string };

export function TailoringDebugView({
  teamName,
  defaultModel,
  promptFingerprint,
  deepSeekKeyConfigured,
  sampleCandidateJson,
  sampleJobDescription,
}: {
  teamName: string | null;
  defaultModel: string;
  promptFingerprint: ResumePromptFingerprint;
  deepSeekKeyConfigured: boolean;
  sampleCandidateJson: string;
  sampleJobDescription: string;
}) {
  const [model, setModel] = useState(defaultModel);
  const [jobDescription, setJobDescription] = useState(sampleJobDescription);
  const [candidateJson, setCandidateJson] = useState(sampleCandidateJson);

  const [result, setResult] = useState<TailoringDebugResult | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Original titles, to show "original → realigned" next to each generated role.
  const originalEntries = parseEntries(candidateJson);

  function run() {
    setSaveMsg(null);
    startRun(async () => {
      const res = await runTailoringDebugAction({ model, jobDescription, candidateJson });
      setResult(res);
    });
  }

  function saveModel() {
    setSaveMsg(null);
    startSave(async () => {
      const res = await saveResumeModelAction(model);
      setSaveMsg(res.ok ? { ok: true, text: "Saved as this team's resume model." } : { ok: false, text: res.error ?? "Failed to save." });
    });
  }

  const ready = promptFingerprint.configured && deepSeekKeyConfigured;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Request</CardTitle>
          <CardDescription>
            Runs the real generation{teamName ? ` for ${teamName}` : ""}: managed prompt + output contract on DeepSeek.
            Edit the candidate or job description and Run.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <div className="font-medium text-foreground">Managed resume prompt</div>
            {promptFingerprint.configured ? (
              <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                <span>
                  Loaded from <code>RESUME_PROMPT_B64</code> · {promptFingerprint.words.toLocaleString()} words ·{" "}
                  {promptFingerprint.characters.toLocaleString()} characters
                </span>
                <span className="break-all">
                  SHA-256 <code className="text-foreground">{promptFingerprint.sha256}</code>
                </span>
                <span>The prompt text is secret and never shown here.</span>
              </div>
            ) : (
              <p className="mt-1 text-destructive">Not configured — set RESUME_PROMPT_B64 on the server.</p>
            )}
            {!deepSeekKeyConfigured && (
              <p className="mt-1 text-destructive">DEEPSEEK_API_KEY is not set on the server.</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model">
              DeepSeek model
            </label>
            <Select id="model" value={model} onChange={(e) => setModel(e.target.value)} className="max-w-sm">
              {RESUME_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="jd">
              Job description
            </label>
            <Textarea id="jd" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={8} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="candidate">
              Candidate profile (JSON)
            </label>
            <Textarea
              id="candidate"
              value={candidateJson}
              onChange={(e) => setCandidateJson(e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} loading={running} disabled={!ready}>
              {running ? <RunningLabel /> : "Run generation"}
            </Button>
            <Button variant="secondary" onClick={saveModel} loading={saving}>
              Save model to team
            </Button>
          </div>
          {saveMsg && <Alert variant={saveMsg.ok ? "success" : "destructive"}>{saveMsg.text}</Alert>}
        </CardContent>
      </Card>

      {/* Response */}
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
          <CardDescription>The generated resume and validation report, plus tokens and latency.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!result && !running && <p className="text-sm text-muted-foreground">Run a request to see the response.</p>}
          {running && (
            <p className="text-sm text-muted-foreground">
              Generating with thinking mode — this usually takes 30–90 seconds.
            </p>
          )}

          {result && !result.ok && <Alert variant="destructive">{result.error}</Alert>}

          {result && result.ok && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Stat label="Model" value={result.model} />
                <Stat label="Latency" value={`${(result.latencyMs / 1000).toFixed(1)}s`} />
                <Stat label="Input tokens" value={String(result.inputTokens ?? 0)} />
                <Stat label="Output tokens" value={String(result.outputTokens ?? 0)} />
                <Stat label="of which reasoning" value={String(result.reasoningTokens ?? 0)} />
              </div>

              {result.content && (
                <div className="flex flex-col gap-4">
                  <Section title="Validation report">
                    <ValidationReportPanel report={result.content.validationReport} />
                  </Section>

                  <Section title="Headline">
                    <p className="text-sm font-medium text-foreground">{result.content.headline}</p>
                  </Section>

                  <Section title="Summary">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{result.content.summary}</p>
                  </Section>

                  <Section title={`Experience (${result.content.workHistory.length} roles)`}>
                    <div className="flex flex-col gap-3">
                      {result.content.workHistory.map((w) => {
                        const original = originalEntries.get(w.entryId);
                        const retitled = original?.jobTitle && w.jobTitle && w.jobTitle !== original.jobTitle;
                        return (
                          <div key={w.entryId}>
                            <div className="text-sm font-medium text-foreground">
                              {w.jobTitle || original?.jobTitle || w.entryId}
                              {original?.company && <span className="text-muted-foreground"> — {original.company}</span>}
                            </div>
                            {retitled && (
                              <div className="text-xs text-muted-foreground">was: {original?.jobTitle}</div>
                            )}
                            <ul className="ml-4 mt-1 list-disc text-sm text-foreground">
                              {w.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </Section>

                  <Section title="Skills">
                    <ul className="ml-4 list-disc text-sm text-foreground">
                      {result.content.skillCategories.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium">{c.category}:</span> {c.skills.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {result.content.orderedCertifications.length > 0 && (
                    <Section title="Certifications">
                      <p className="text-sm text-foreground">{result.content.orderedCertifications.join(" · ")}</p>
                    </Section>
                  )}
                </div>
              )}

              <details className="rounded-md border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Raw JSON</summary>
                <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">{result.rawJson}</pre>
              </details>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function parseEntries(candidateJson: string): Map<string, CandidateEntry> {
  try {
    const parsed = JSON.parse(candidateJson) as { workHistory?: CandidateEntry[] };
    return new Map((parsed.workHistory ?? []).map((w) => [w.id, w]));
  } catch {
    return new Map();
  }
}

/** Rendered only while a run is in flight, so its timer starts at zero each run. */
function RunningLabel() {
  const seconds = useElapsedSeconds();
  return <>Generating… {seconds}s</>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
