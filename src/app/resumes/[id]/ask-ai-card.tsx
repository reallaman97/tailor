"use client";

import { useState, useTransition } from "react";
import { deleteAnswerAction } from "./assist-actions";
import { requestAnswer } from "./assist-client";
import { CopyButton } from "./copy-button";
import type { SavedAnswer } from "@/lib/assist/store";
import type { AnswerLength } from "@/lib/assist/prompts";
import { useElapsedSeconds } from "@/lib/use-elapsed-seconds";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SparklesIcon, TrashIcon } from "@/components/icons";

const LENGTH_OPTIONS: { value: AnswerLength; label: string }[] = [
  { value: "brief", label: "Brief — 25–40 words" },
  { value: "standard", label: "Standard — 50–70 words" },
  { value: "detailed", label: "Detailed — 90–120 words" },
];
const LENGTH_LABEL: Record<AnswerLength, string> = { brief: "Brief", standard: "Standard", detailed: "Detailed" };

/**
 * "Ask AI": paste a question from the application form and get an answer
 * written as the candidate, consistent with the tailored resume. Answers are
 * saved with the application so they can be copied again later.
 */
export function AskAiCard({ resumeId, initialAnswers }: { resumeId: string; initialAnswers: SavedAnswer[] }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [question, setQuestion] = useState("");
  const [length, setLength] = useState<AnswerLength>("standard");
  const [charLimit, setCharLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startAsk] = useTransition();

  const limitNumber = charLimit.trim() ? Number(charLimit) : null;
  const limitInvalid = limitNumber !== null && (!Number.isInteger(limitNumber) || limitNumber < 50 || limitNumber > 10000);
  const questionTooShort = question.trim().length < 5;

  function ask() {
    setError(null);
    if (questionTooShort) return setError("Type the question from the application form.");
    if (limitInvalid) return setError("Character limit must be a whole number between 50 and 10,000.");
    startAsk(async () => {
      try {
        const result = await requestAnswer(resumeId, { question, length, charLimit: limitNumber });
        if (result.error) return setError(result.error);
        if (result.answer) {
          const answer = result.answer;
          // A repeated question returns its saved answer — move it to the top rather than duplicating it.
          setAnswers((current) => [answer, ...current.filter((a) => a.id !== answer.id)]);
          setQuestion("");
          setNotice(result.reused ? "Already answered for this application — showing the saved answer (no new AI call)." : null);
        }
      } catch {
        setError("Couldn't reach the server — check your connection and try again.");
      }
    });
  }

  async function remove(answerId: string) {
    if (!window.confirm("Delete this question and answer?")) return;
    const previous = answers;
    setAnswers((current) => current.filter((a) => a.id !== answerId));
    try {
      const result = await deleteAnswerAction(resumeId, answerId);
      if (result.error) {
        setAnswers(previous);
        setError(result.error);
      }
    } catch {
      setAnswers(previous);
      setError("Couldn't delete — check your connection and try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask AI — application questions</CardTitle>
        <CardDescription>
          Paste a question from the application form. The answer is written as the candidate, from the tailored resume
          and this job description. Facts the resume can&apos;t confirm (salary, work authorization…) are left as{" "}
          <mark className="rounded bg-warning/20 px-1 text-foreground">[placeholders]</mark> for you to fill in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <FormField label="Question" htmlFor={`ask-question-${resumeId}`} required>
            <Textarea
              id={`ask-question-${resumeId}`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !pending) ask();
              }}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Describe your experience building production ML pipelines. / Why do you want to work here?"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <FormField label="Answer length" htmlFor={`ask-length-${resumeId}`}>
              <Select id={`ask-length-${resumeId}`} value={length} onChange={(e) => setLength(e.target.value as AnswerLength)}>
                {LENGTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Character limit"
              htmlFor={`ask-limit-${resumeId}`}
              hint="Optional — if the form has one."
              error={limitInvalid ? "50–10,000" : undefined}
            >
              <Input
                id={`ask-limit-${resumeId}`}
                type="number"
                inputMode="numeric"
                min={50}
                max={10000}
                value={charLimit}
                onChange={(e) => setCharLimit(e.target.value)}
                placeholder="e.g. 500"
              />
            </FormField>
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          {!error && notice && <Alert>{notice}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={ask} loading={pending} disabled={questionTooShort || limitInvalid}>
              {pending ? <Elapsed /> : (
                <>
                  <SparklesIcon className="size-4" />
                  Ask AI
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">Ctrl+Enter to ask</span>
          </div>
        </div>

        {answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions answered yet for this application.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {answers.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">{a.question}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  <HighlightPlaceholders text={a.answer} />
                </p>
                {a.needsReview && a.reviewNote && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                    <span className="font-semibold">Before you submit:</span> {a.reviewNote}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={a.answer} />
                  <Badge variant="secondary">{LENGTH_LABEL[a.length] ?? a.length}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {a.answer.length.toLocaleString()}
                    {a.charLimit ? ` / ${a.charLimit.toLocaleString()}` : ""} characters
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(a.id)}
                    aria-label="Delete this answer"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Highlights [bracketed placeholders] the applicant still has to fill in. */
function HighlightPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{2,120}\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[.*\]$/.test(part) ? (
          <mark key={i} className="rounded bg-warning/20 px-1 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Elapsed() {
  const seconds = useElapsedSeconds();
  return <>Thinking… {seconds}s</>;
}
