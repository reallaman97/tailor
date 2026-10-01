// Pure text helpers for base-resume import — no server-only imports, so the
// review UI can reuse the types and limits.

/** Upload cap — Vercel rejects request bodies over 4.5MB. */
export const MAX_BASE_RESUME_BYTES = 4 * 1024 * 1024;
/** Plenty for a long resume (~8–9k words); bounds the parse call's cost. */
export const MAX_BASE_RESUME_CHARS = 60_000;
/** Below this, the "resume" is almost certainly a failed extraction (e.g. a scanned image PDF). */
export const MIN_BASE_RESUME_CHARS = 200;

/** Normalizes extracted text: unified newlines, tabs → spaces, no trailing spaces, at most one blank line. */
export function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t+/g, "  ")
    .replace(/[  ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// North-American style numbers with optional country code: +1 (555) 010-4477, 555.010.4477, 5550104477 …
const PHONE_PATTERN = /(?<![\d-])(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\d-])/g;
const LINKEDIN_PATTERN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?/i;

export type ExtractedContact = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

/**
 * Contact details found by pattern matching — done locally so email and phone
 * never have to be sent to the AI provider (see redactContact).
 */
export function extractContact(text: string): ExtractedContact {
  const email = text.match(EMAIL_PATTERN)?.[0] ?? null;
  const phone = text.match(PHONE_PATTERN)?.[0]?.trim() ?? null;
  const linkedin = text.match(LINKEDIN_PATTERN)?.[0] ?? null;
  return {
    email,
    phone,
    linkedinUrl: linkedin ? (/^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`) : null,
  };
}

/** The text with emails and phone numbers masked, for sending to the parser model. */
export function redactContact(text: string): string {
  return text.replace(EMAIL_PATTERN, "[email]").replace(PHONE_PATTERN, "[phone]");
}

/** Lowercased alphanumerics only — so quotes, dashes, bullet glyphs and wrapping don't affect matching. */
function comparable(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type VerbatimCheck = {
  bulletsTotal: number;
  bulletsMatched: number;
  /** Bullets whose text couldn't be found in the source — possibly reworded by the parser. */
  unmatched: string[];
};

/** Confirms each parsed bullet appears in the source text (ignoring punctuation, case and line wrapping). */
export function checkBulletsVerbatim(bullets: string[], sourceText: string): VerbatimCheck {
  const source = comparable(sourceText);
  const unmatched = bullets.filter((b) => {
    const needle = comparable(b);
    return needle.length > 0 && !source.includes(needle);
  });
  return { bulletsTotal: bullets.length, bulletsMatched: bullets.length - unmatched.length, unmatched };
}

/** Coerces a model-returned date to YYYY-MM ("2020-08", "2020-08-01", "2020" → "2020-01"); null if unusable. */
export function toYearMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const ym = /^(\d{4})-(0[1-9]|1[0-2])/.exec(trimmed);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const year = /^(\d{4})$/.exec(trimmed);
  return year ? `${year[1]}-01` : null;
}
