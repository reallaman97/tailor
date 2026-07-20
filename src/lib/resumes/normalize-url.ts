const TRACKING_PARAM_PREFIXES = ["utm_"];

// Analytics/tracking params only — never a param that could be how a job
// board identifies the specific posting (e.g. Greenhouse's gh_jid, Lever's
// lever-source, Workday job IDs all stay untouched).
const TRACKING_PARAMS = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "dclid",
  "twclid",
  "yclid",
  "ref",
  "ref_src",
  "referrer",
  "trk",
  "trkcampaign",
  "li_fat_id",
  "s_kwcid",
]);

/**
 * Strips tracking/analytics query params, the hash fragment, and a bare
 * trailing slash, then sorts the remaining query params — so two links to
 * the same posting (e.g. shared via different tracking-tagged URLs) collapse
 * to the same stored string for duplicate detection. Leaves the input
 * untouched if it isn't a valid absolute URL, since there's nothing safe to
 * normalize.
 */
export function normalizeJobUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
