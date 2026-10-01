import { createHash } from "node:crypto";

// Pure helpers behind the duplicate checker (see findDuplicateApplication in
// resumes.ts). Every rule here runs BEFORE any AI call, so a duplicate never
// costs tokens.

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

// Legal-entity and filler words that don't distinguish one company from
// another — "Acme Inc." and "ACME, LLC" are the same employer.
const COMPANY_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "llp", "lp", "ltd", "limited", "corp", "corporation", "co", "company",
  "plc", "gmbh", "ag", "sa", "sas", "srl", "spa", "bv", "nv", "pty", "pvt", "private", "pte", "oy", "ab",
  "as", "kk", "the", "holdings", "group",
]);

// Placeholder employer names — two "Confidential" postings are usually
// different companies, so these never block each other by name (the posting
// and description rules still apply).
const GENERIC_COMPANIES = new Set([
  "confidential", "confidential company", "undisclosed", "stealth", "stealth startup", "stealth mode",
  "anonymous", "unknown", "na", "n a", "none", "company", "client", "our client", "hiring company",
  "private company", "startup", "a startup",
]);

/**
 * A normalized company identity: lowercase, accents/punctuation stripped,
 * "&" → "and", parentheticals and web domains ("acme.io") dropped, legal
 * suffixes removed. Null for empty or placeholder names ("Confidential").
 */
export function companyKey(name: string): string | null {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Dotted initials ("S.A.", "L.L.C.") → one word ("sa", "llc") before punctuation goes.
    .replace(/\b[a-z](?:\.[a-z])+\.?/g, (m) => m.replace(/\./g, ""))
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\.(com|io|ai|co|net|org|dev|app|tech)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!base || GENERIC_COMPANIES.has(base)) return null;

  const words = base.split(" ");
  // A multi-word name made only of filler ("The Company LLC") identifies nobody.
  if (words.length > 1 && words.every((w) => COMPANY_SUFFIXES.has(w))) return null;
  // Strip legal suffixes from the end (and a leading "the"), keeping at least one word.
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  while (words.length > 1 && words[0] === "the") words.shift();
  const key = words.join(" ");
  return GENERIC_COMPANIES.has(key) ? null : key;
}

// ---------------------------------------------------------------------------
// Job posting URL
// ---------------------------------------------------------------------------

/** Pulls a posting id out of well-known job-board URL shapes; null when the URL isn't one of them. */
function boardPostingId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;
  const param = (name: string) => url.searchParams.get(name);

  if (host.endsWith("linkedin.com")) {
    const id = param("currentJobId") ?? /\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/.exec(path)?.[1];
    if (id && /^\d+$/.test(id)) return `linkedin:${id}`;
  }
  // Greenhouse boards, and company career sites embedding Greenhouse (?gh_jid=).
  const ghJid = param("gh_jid");
  if (ghJid && /^\d+$/.test(ghJid)) return `greenhouse:${ghJid}`;
  if (host.endsWith("greenhouse.io")) {
    const id = /\/jobs\/(\d+)/.exec(path)?.[1];
    if (id) return `greenhouse:${id}`;
  }
  if (host.endsWith("lever.co")) {
    const id = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(path)?.[1];
    if (id) return `lever:${id.toLowerCase()}`;
  }
  if (host.endsWith("ashbyhq.com")) {
    const id = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(path)?.[1];
    if (id) return `ashby:${id.toLowerCase()}`;
  }
  if (host.includes("indeed.")) {
    const id = param("jk") ?? param("vjk");
    if (id) return `indeed:${id.toLowerCase()}`;
  }
  if (host.endsWith("myworkdayjobs.com") || host.endsWith("myworkdaysite.com")) {
    // .../job/<location>/<Title>_<REQ-ID>  (the requisition id is the stable part)
    const req = /\/job\/[^?#]*_([A-Za-z0-9-]+)(?:\/|$)/.exec(path)?.[1];
    if (req) return `workday:${host.split(".")[0]}:${req.toLowerCase()}`;
  }
  if (host.endsWith("smartrecruiters.com")) {
    const id = /\/(\d{6,})/.exec(path)?.[1];
    if (id) return `smartrecruiters:${id}`;
  }
  if (host.includes("glassdoor.")) {
    const id = param("jobListingId") ?? /_JV_[^.]*?KO\d+,\d+_KE\d+,\d+\.htm/.exec(path)?.[0] ?? null;
    if (id) return `glassdoor:${id.toLowerCase()}`;
  }
  return null;
}

// Query params that only track how someone arrived at a posting.
const TRACKING_PARAM = /^(utm_|gclid$|fbclid$|msclkid$|mc_[ce]id$|igshid$|ref$|ref_src$|referrer$|src$|source$|trk|refid$|tracking|lipi$|li_fat_id$|_ga$|gh_src$|lever-source)/i;

/**
 * A canonical key for the posting a URL points at: the job board's own posting
 * id when recognizable (so the same LinkedIn job reached via /jobs/view/123,
 * ?currentJobId=123, or a tracking link all match), else the URL without
 * scheme, "www.", tracking params, fragment, trailing slash, or case. Null if
 * it isn't a URL.
 */
export function jobPostingKey(rawUrl: string | null | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const board = boardPostingId(url);
  if (board) return board;

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const query = url.searchParams.toString();
  const path = url.pathname.replace(/\/+$/, "");
  return `url:${url.hostname.replace(/^www\./, "")}${path}${query ? `?${query}` : ""}`.toLowerCase();
}

// ---------------------------------------------------------------------------
// Job description text
// ---------------------------------------------------------------------------

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

// Below this, a description is too short to identify a posting by its text.
const MIN_FINGERPRINT_WORDS = 40;

/** Hash of the description's words (case, punctuation, spacing ignored); null if it's too short to be meaningful. */
export function jdFingerprint(text: string): string | null {
  const w = words(text);
  if (w.length < MIN_FINGERPRINT_WORDS) return null;
  return createHash("sha256").update(w.join(" ")).digest("hex").slice(0, 32);
}

const SHINGLE = 5;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hashed 5-word shingles — the unit of near-duplicate comparison. */
export function shingles(text: string): Set<number> {
  const w = words(text);
  const out = new Set<number>();
  for (let i = 0; i + SHINGLE <= w.length; i++) out.add(fnv1a(w.slice(i, i + SHINGLE).join(" ")));
  return out;
}

/** Jaccard similarity of two shingle sets (0–1). */
export function similarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const x of small) if (large.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Two descriptions this similar are the same posting (e.g. re-posted by a
 * recruiter, or copied with a different header) — different jobs at the same
 * level, even from one company, share far less 5-word phrasing.
 */
export const NEAR_DUPLICATE_THRESHOLD = 0.8;
