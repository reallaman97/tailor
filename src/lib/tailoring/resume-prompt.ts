import { createHash } from "node:crypto";

/**
 * The secret resume-generation prompt. It lives ONLY in the RESUME_PROMPT_B64
 * environment variable (base64-encoded UTF-8) — never in the repo, the DB, or
 * any page — and is sent verbatim to the model as its system prompt. Nothing in
 * the app edits, trims, or appends to it: the output-format contract the app
 * needs is sent as a separate message (see generate.ts).
 *
 * Base64 keeps the multi-line markdown (and characters like ’ → –) intact
 * through .env files and hosting dashboards. Encode an updated prompt with:
 *   node -e "process.stdout.write(Buffer.from(require('fs').readFileSync('prompt.md','utf8')).toString('base64'))"
 */

export class ResumePromptMissingError extends Error {
  constructor() {
    super("Resume generation isn't configured — the RESUME_PROMPT_B64 environment variable is missing.");
  }
}

function decode(): string | null {
  const encoded = process.env.RESUME_PROMPT_B64?.trim();
  if (!encoded) return null;
  const prompt = Buffer.from(encoded, "base64").toString("utf8");
  return prompt.trim() ? prompt : null;
}

/** The exact prompt text. Throws if it isn't configured. */
export function getResumePrompt(): string {
  const prompt = decode();
  if (!prompt) throw new ResumePromptMissingError();
  return prompt;
}

export type ResumePromptFingerprint =
  | { configured: false }
  | { configured: true; sha256: string; characters: number; words: number };

/**
 * Identifies the configured prompt without revealing it — lets a service admin
 * confirm the deployed prompt is the expected, unmodified one.
 */
export function getResumePromptFingerprint(): ResumePromptFingerprint {
  const prompt = decode();
  if (!prompt) return { configured: false };
  return {
    configured: true,
    sha256: createHash("sha256").update(prompt, "utf8").digest("hex"),
    characters: prompt.length,
    words: prompt.split(/\s+/).filter(Boolean).length,
  };
}
