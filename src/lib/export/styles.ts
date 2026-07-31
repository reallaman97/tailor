/**
 * Built-in resume PDF styles. Each is a visual configuration consumed by the
 * single parameterized template (templates/styled.tsx) — this is why adding a
 * style is a config entry, not a new component. Every style stays ATS-safe:
 * single column, standard PDF fonts (Helvetica / Times / Courier), no tables or
 * images. Section ORDER and CONTENT are identical across styles; only typography,
 * color, and section-heading treatment differ.
 *
 * A profile picks a style by `key` (Profile.resumeTemplate); when unset the app
 * default (AppSettings.resumeTemplate, mapped via styleKeyFromAppDefault) applies.
 */

export type HeadingStyle = "underline" | "centeredUnderline" | "bar" | "leftBorder" | "plain";

export type ResumeStyle = {
  key: string;
  name: string;
  description: string;
  // Standard @react-pdf built-in font family (regular / bold / italic variants).
  bodyFont: string;
  boldFont: string;
  italicFont: string;
  fontSize: number;
  pagePadding: number;
  textColor: string;
  mutedColor: string;
  accent: string;
  nameAlign: "left" | "center";
  nameUpper: boolean;
  nameSize: number;
  headerDivider: boolean;
  headingStyle: HeadingStyle;
  headingUpper: boolean;
  /** Heading text color; for the "bar" style the bar is `accent` and text is white. */
  headingColor: string;
  bulletChar: string;
};

const HELVETICA = { bodyFont: "Helvetica", boldFont: "Helvetica-Bold", italicFont: "Helvetica-Oblique" };
const TIMES = { bodyFont: "Times-Roman", boldFont: "Times-Bold", italicFont: "Times-Italic" };
const COURIER = { bodyFont: "Courier", boldFont: "Courier-Bold", italicFont: "Courier-Oblique" };

export const RESUME_STYLES: ResumeStyle[] = [
  {
    key: "modern",
    name: "Modern",
    description: "Clean sans-serif, left-aligned name, understated gray section rules.",
    ...HELVETICA,
    fontSize: 10,
    pagePadding: 40,
    textColor: "#111111",
    mutedColor: "#333333",
    accent: "#999999",
    nameAlign: "left",
    nameUpper: false,
    nameSize: 20,
    headerDivider: false,
    headingStyle: "underline",
    headingUpper: true,
    headingColor: "#111111",
    bulletChar: "•",
  },
  {
    key: "classic",
    name: "Classic",
    description: "Traditional serif, centered uppercase name, centered underlined headings.",
    ...TIMES,
    fontSize: 10.5,
    pagePadding: 48,
    textColor: "#1a1a1a",
    mutedColor: "#333333",
    accent: "#1a1a1a",
    nameAlign: "center",
    nameUpper: true,
    nameSize: 22,
    headerDivider: true,
    headingStyle: "centeredUnderline",
    headingUpper: true,
    headingColor: "#1a1a1a",
    bulletChar: "–",
  },
  {
    key: "executive",
    name: "Executive",
    description: "Bold navy filled section bars for a confident, senior-level look.",
    ...HELVETICA,
    fontSize: 10,
    pagePadding: 42,
    textColor: "#1a1a1a",
    mutedColor: "#444444",
    accent: "#1e3a5f",
    nameAlign: "left",
    nameUpper: true,
    nameSize: 22,
    headerDivider: true,
    headingStyle: "bar",
    headingUpper: true,
    headingColor: "#1e3a5f",
    bulletChar: "•",
  },
  {
    key: "minimalist",
    name: "Minimalist",
    description: "Maximum whitespace, plain headings, no rules — quiet and elegant.",
    ...HELVETICA,
    fontSize: 10,
    pagePadding: 54,
    textColor: "#222222",
    mutedColor: "#666666",
    accent: "#222222",
    nameAlign: "left",
    nameUpper: false,
    nameSize: 18,
    headerDivider: false,
    headingStyle: "plain",
    headingUpper: true,
    headingColor: "#111111",
    bulletChar: "·",
  },
  {
    key: "technical",
    name: "Technical",
    description: "Monospaced Courier with teal left-border headings — engineer-friendly.",
    ...COURIER,
    fontSize: 9.5,
    pagePadding: 40,
    textColor: "#1a1a1a",
    mutedColor: "#444444",
    accent: "#0f766e",
    nameAlign: "left",
    nameUpper: false,
    nameSize: 16,
    headerDivider: true,
    headingStyle: "leftBorder",
    headingUpper: true,
    headingColor: "#0f766e",
    bulletChar: ">",
  },
  {
    key: "elegant",
    name: "Elegant",
    description: "Refined serif with deep burgundy accents and thin underlines.",
    ...TIMES,
    fontSize: 10.5,
    pagePadding: 46,
    textColor: "#222222",
    mutedColor: "#555555",
    accent: "#7c2d3a",
    nameAlign: "left",
    nameUpper: false,
    nameSize: 21,
    headerDivider: false,
    headingStyle: "underline",
    headingUpper: true,
    headingColor: "#7c2d3a",
    bulletChar: "•",
  },
  {
    key: "compact",
    name: "Compact",
    description: "Dense layout with slate section bars — fits more on one page.",
    ...HELVETICA,
    fontSize: 9,
    pagePadding: 32,
    textColor: "#111111",
    mutedColor: "#444444",
    accent: "#374151",
    nameAlign: "left",
    nameUpper: true,
    nameSize: 16,
    headerDivider: false,
    headingStyle: "bar",
    headingUpper: true,
    headingColor: "#374151",
    bulletChar: "•",
  },
  {
    key: "professional",
    name: "Professional",
    description: "Centered header with clean blue underlined headings.",
    ...HELVETICA,
    fontSize: 10,
    pagePadding: 44,
    textColor: "#111111",
    mutedColor: "#444444",
    accent: "#2563eb",
    nameAlign: "center",
    nameUpper: false,
    nameSize: 20,
    headerDivider: true,
    headingStyle: "underline",
    headingUpper: true,
    headingColor: "#2563eb",
    bulletChar: "•",
  },
  {
    key: "academic",
    name: "Academic",
    description: "Roomy serif with generous line spacing for a scholarly feel.",
    ...TIMES,
    fontSize: 11,
    pagePadding: 52,
    textColor: "#1a1a1a",
    mutedColor: "#444444",
    accent: "#333333",
    nameAlign: "left",
    nameUpper: false,
    nameSize: 20,
    headerDivider: true,
    headingStyle: "underline",
    headingUpper: false,
    headingColor: "#111111",
    bulletChar: "•",
  },
  {
    key: "bold",
    name: "Bold",
    description: "Large uppercase name with vivid orange section bars — high impact.",
    ...HELVETICA,
    fontSize: 10,
    pagePadding: 40,
    textColor: "#111111",
    mutedColor: "#444444",
    accent: "#ea580c",
    nameAlign: "left",
    nameUpper: true,
    nameSize: 24,
    headerDivider: false,
    headingStyle: "bar",
    headingUpper: true,
    headingColor: "#ea580c",
    bulletChar: "▪",
  },
];

export const DEFAULT_STYLE_KEY = "modern";

export const RESUME_STYLE_KEYS = RESUME_STYLES.map((s) => s.key);

export function isResumeStyleKey(key: string): boolean {
  return RESUME_STYLE_KEYS.includes(key);
}

/** Resolves a style by key, falling back to the default when unknown/unset. */
export function getResumeStyle(key: string | null | undefined): ResumeStyle {
  return (
    RESUME_STYLES.find((s) => s.key === key) ??
    RESUME_STYLES.find((s) => s.key === DEFAULT_STYLE_KEY)!
  );
}

/** Maps the legacy app-wide default enum (MODERN/CLASSIC) to a style key. */
export function styleKeyFromAppDefault(appDefault: "MODERN" | "CLASSIC"): string {
  return appDefault === "CLASSIC" ? "classic" : "modern";
}

/**
 * The effective style key for a resume: the profile's chosen style if set,
 * otherwise the app-wide default.
 */
export function effectiveStyleKey(
  profileTemplate: string | null | undefined,
  appDefault: "MODERN" | "CLASSIC"
): string {
  if (profileTemplate && isResumeStyleKey(profileTemplate)) return profileTemplate;
  return styleKeyFromAppDefault(appDefault);
}
