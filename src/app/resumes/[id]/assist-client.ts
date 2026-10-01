import type { CoverLetterResult, AskQuestionResult } from "@/lib/assist/service";
import type { AnswerLength } from "@/lib/assist/prompts";

/**
 * POSTs to an assist route and reads its `{ ...result, error? }` JSON. Plain
 * fetch (not a server action) so a slow AI call runs alongside the page's
 * other actions instead of blocking them.
 */
async function postAssist<T extends { error?: string }>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { error: "Couldn't reach the server — check your connection and try again." } as T;
  }
  // A signed-out session is redirected to the login page (HTML), and a platform
  // timeout returns a plain error page — neither is JSON.
  if (!res.headers.get("content-type")?.includes("application/json")) {
    if (res.redirected) return { error: "Your session has expired — sign in again." } as T;
    return { error: "The request took too long — try again in a minute." } as T;
  }
  return (await res.json()) as T;
}

export function requestCoverLetter(resumeId: string, instructions: string) {
  return postAssist<CoverLetterResult>(`/api/resumes/${encodeURIComponent(resumeId)}/assist/cover-letter`, { instructions });
}

export function requestAnswer(resumeId: string, input: { question: string; length: AnswerLength; charLimit: number | null }) {
  return postAssist<AskQuestionResult>(`/api/resumes/${encodeURIComponent(resumeId)}/assist/ask`, input);
}
