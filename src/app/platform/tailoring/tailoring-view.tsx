"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { runTailoringDebugAction, saveTailoringDefaultsAction } from "./actions";
import type { TailoringDebugResult } from "@/lib/tailoring/debug";

const MODEL_SUGGESTIONS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini"];

export function TailoringDebugView({
  teamName,
  defaultModel,
  defaultPrompt,
  sampleCandidateJson,
  sampleJobDescription,
}: {
  teamName: string | null;
  defaultModel: string;
  defaultPrompt: string;
  sampleCandidateJson: string;
  sampleJobDescription: string;
}) {
  const [model, setModel] = useState(defaultModel);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [jobDescription, setJobDescription] = useState(sampleJobDescription);
  const [candidateJson, setCandidateJson] = useState(sampleCandidateJson);

  const [result, setResult] = useState<TailoringDebugResult | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setSaveMsg(null);
    startRun(async () => {
      const res = await runTailoringDebugAction({ systemPrompt: prompt, model, jobDescription, candidateJson });
      setResult(res);
    });
  }

  function saveDefaults() {
    setSaveMsg(null);
    startSave(async () => {
      const res = await saveTailoringDefaultsAction(model, prompt);
      setSaveMsg(res.ok ? { ok: true, text: "Saved as this team's model + prompt." } : { ok: false, text: res.error ?? "Failed to save." });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Request</CardTitle>
          <CardDescription>
            Runs the real tailoring call{teamName ? ` with ${teamName}'s OpenAI key` : ""}. Edit anything and Run.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model">
              OpenAI model
            </label>
            <Input
              id="model"
              list="model-suggestions"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4.1-mini"
              className="max-w-xs"
            />
            <datalist id="model-suggestions">
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="prompt">
              System prompt
            </label>
            <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={10} className="font-mono text-xs" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="jd">
              Job description
            </label>
            <Textarea id="jd" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={6} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="candidate">
              Candidate profile (JSON)
            </label>
            <Textarea
              id="candidate"
              value={candidateJson}
              onChange={(e) => setCandidateJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} loading={running}>
              {running ? "Running…" : "Run tailoring"}
            </Button>
            <Button variant="secondary" onClick={saveDefaults} loading={saving}>
              Save model + prompt to team
            </Button>
          </div>
          {saveMsg && <Alert variant={saveMsg.ok ? "success" : "destructive"}>{saveMsg.text}</Alert>}
        </CardContent>
      </Card>

      {/* Response */}
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
          <CardDescription>The structured output from OpenAI, plus tokens and latency.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!result && <p className="text-sm text-muted-foreground">Run a request to see the response.</p>}

          {result && !result.ok && <Alert variant="destructive">{result.error}</Alert>}

          {result && result.ok && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Stat label="Model" value={result.model} />
                <Stat label="Latency" value={`${(result.latencyMs / 1000).toFixed(1)}s`} />
                <Stat label="Input tokens" value={String(result.inputTokens ?? 0)} />
                <Stat label="Output tokens" value={String(result.outputTokens ?? 0)} />
              </div>

              {result.content && (
                <div className="flex flex-col gap-4">
                  <Section title="Headline">
                    <p className="text-sm font-medium text-foreground">{result.content.headline}</p>
                  </Section>

                  <Section title="Summary">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{result.content.summary}</p>
                  </Section>

                  <Section title={`Work history (${result.content.workHistory.length} entries)`}>
                    <div className="flex flex-col gap-3">
                      {result.content.workHistory.map((w) => (
                        <div key={w.entryId}>
                          <div className="text-xs font-medium text-muted-foreground">entryId: {w.entryId}</div>
                          <ul className="ml-4 list-disc text-sm text-foreground">
                            {w.bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="Skill categories">
                    <ul className="ml-4 list-disc text-sm text-foreground">
                      {result.content.skillCategories.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium">{c.category}:</span> {c.skills.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {result.content.orderedCertifications.length > 0 && (
                    <Section title="Ordered certifications">
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
