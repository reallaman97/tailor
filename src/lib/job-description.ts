// Token-saving preparation of a job description before it's sent to an AI
// model. The stored description is never changed — only what's sent.

// Phrases that only appear in legal/HR boilerplate: equal-opportunity
// statements, accommodation and E-Verify notices, pay-transparency and
// privacy notices, recruitment-fraud warnings. None of it informs a resume,
// cover letter, answer, or stack check, and it's often a quarter of a posting.
const BOILERPLATE_MARKERS = [
  /equal (employment )?opportunity/i,
  /\beeo\b/i,
  /without regard to/i,
  /sexual orientation|gender identity|protected veteran|genetic information|national origin/i,
  /affirmative action/i,
  /reasonable accommodation/i,
  /\be-?verify\b/i,
  /pay transparency|salary transparency/i,
  /(applicant|candidate|recruitment) privacy (notice|policy)/i,
  /privacy (notice|policy) for (applicants|candidates)/i,
  /(recruitment|recruiting|hiring) (fraud|scam)/i,
  /unsolicited (resumes|agency|candidates)/i,
  /fair chance (ordinance|act)|arrest (and|or) conviction records/i,
];

// A paragraph that looks like it describes the job itself is kept even if it
// also mentions one of the phrases above (e.g. "a stable, equal-opportunity
// team building Kafka pipelines…").
const JOB_CONTENT_HINTS =
  /\b(experience|responsib|require|qualif|skills?|years|engineer|develop|design|build|stack|python|java|react|aws|sql)\b/i;

/**
 * Normalizes whitespace and drops pure legal/HR boilerplate paragraphs.
 * Conservative: when in doubt a paragraph stays.
 */
export function compactJobDescription(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = normalized.split(/\n{2,}/);
  const kept = paragraphs.filter((p) => {
    const markers = BOILERPLATE_MARKERS.filter((m) => m.test(p)).length;
    if (markers === 0) return true;
    // Long paragraphs with real job content stay unless they're clearly boilerplate.
    return JOB_CONTENT_HINTS.test(p) && markers < 2 && p.length > 400;
  });
  return kept.join("\n\n");
}
