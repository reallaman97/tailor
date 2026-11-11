import { z } from "zod";
import { callJson, type AssistUsage } from "@/lib/assist/generate";
import type { Classification, EmailInput } from "@/lib/inbox/classify-rules";

// The second pass, for emails the rules can't decide (classify-rules.ts):
// recruiter outreach, conversations, resume requests, mixed signals. Reasoning
// is off — it's extraction, answered in a second or two with the fast model.

const CATEGORIES = [
  "APPLICATION_RECEIVED",
  "REJECTION",
  "NEXT_STEP",
  "RECRUITER_OUTREACH",
  "CONVERSATION",
  "RESUME_REQUEST",
  "OTHER",
] as const;

const INSTRUCTIONS = `You sort a job seeker's incoming emails. Read the email and return json:
{
  "category": one of:
    "APPLICATION_RECEIVED" — automated confirmation that an application was received;
    "REJECTION" — the company is not moving forward;
    "NEXT_STEP" — an invitation to the next stage of an application: an interview, phone screen, assessment / coding test, or AI / video interview;
    "RECRUITER_OUTREACH" — a recruiter or company reaching out about a role the candidate hasn't applied to;
    "CONVERSATION" — ongoing back-and-forth with a recruiter: scheduling, rescheduling, questions, follow-ups, confirmations;
    "RESUME_REQUEST" — someone asks the candidate to send their resume / CV (often "updated", often in Word format). Use this whenever a resume is asked for, even if the email is also outreach about a new role or part of a conversation;
    "OTHER" — job alerts, newsletters, marketing, account notices, anything unrelated to a specific application.
  "workMode": "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" — how the role is described ("UNKNOWN" if not stated);
  "companyName": the hiring company (not the staffing agency, not the ATS like Greenhouse/Lever/Workday), or null;
  "jobTitle": the role's title, or null;
  "nextStepKind": for NEXT_STEP only — "interview" | "assessment" | "ai_interview" | "other"; else null;
  "needsReply": true if the sender asks a question, asks for availability, or otherwise expects a reply from the candidate;
  "confidence": 0 to 1, how sure you are of the category;
  "summary": one short sentence (max 25 words) saying what the email says or asks.
}`;

const schema = z.object({
  category: z.enum(CATEGORIES).catch("OTHER"),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]).catch("UNKNOWN"),
  companyName: z.string().trim().min(1).max(200).nullable().catch(null),
  jobTitle: z.string().trim().min(1).max(200).nullable().catch(null),
  nextStepKind: z.enum(["interview", "assessment", "ai_interview", "other"]).nullable().catch(null),
  needsReply: z.boolean().catch(false),
  confidence: z.number().min(0).max(1).catch(0.5),
  summary: z.string().trim().max(400).catch(""),
});

export async function classifyWithLlm(email: EmailInput): Promise<{ classification: Classification; usage: AssistUsage }> {
  const user = [
    `FROM: ${email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}`,
    `SUBJECT: ${email.subject}`,
    "",
    email.text.slice(0, 4000),
  ].join("\n");
  const { data, usage } = await callJson(INSTRUCTIONS, user, schema, { thinking: false });
  return {
    classification: {
      ...data,
      nextStepKind: data.category === "NEXT_STEP" ? (data.nextStepKind ?? "other") : null,
      summary: data.summary || email.subject,
    },
    usage,
  };
}

const REPLY_INSTRUCTIONS = `You write email replies for a job seeker, as the job seeker, to a recruiter or hiring team.
Rules:
- Short, warm, professional: 40–120 words. Plain text, no subject line, no markdown.
- Start with a greeting using the sender's first name if known ("Hi Dana,"), end with the candidate's first name.
- Answer what the email asks. If it asks for availability, offer to meet and leave placeholders for the times, e.g. "[Option 1 — day, time, time zone]" — never invent times or dates.
- If it's a new remote opportunity, express interest and ask one useful question (e.g. compensation range or interview process) unless already answered.
- If a resume is requested and ATTACHING_RESUME is yes, say the updated resume is attached (Word format).
- Never invent facts about the candidate (salary, notice period, work authorization, visa): use a [placeholder] instead.`;

const replySchema = z.object({ reply: z.string().trim().min(10) });

export async function suggestReply(input: {
  candidateName: string;
  email: { fromName: string | null; fromAddress: string; subject: string; text: string };
  application: { companyName: string; jobTitle: string } | null;
  attachingResume: boolean;
}): Promise<{ reply: string; usage: AssistUsage }> {
  const user = [
    `CANDIDATE: ${input.candidateName}`,
    input.application ? `APPLICATION: ${input.application.jobTitle} at ${input.application.companyName}` : "APPLICATION: (none on file)",
    `ATTACHING_RESUME: ${input.attachingResume ? "yes" : "no"}`,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "EMAIL TO REPLY TO:",
    `From: ${input.email.fromName ? `${input.email.fromName} <${input.email.fromAddress}>` : input.email.fromAddress}`,
    `Subject: ${input.email.subject}`,
    "",
    input.email.text.slice(0, 5000),
    "",
    'Return json: { "reply": "..." }',
  ].join("\n");
  const { data, usage } = await callJson(REPLY_INSTRUCTIONS, user, replySchema);
  return { reply: data.reply.replace(/\*\*(.+?)\*\*/g, "$1").trim(), usage };
}
