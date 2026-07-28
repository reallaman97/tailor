/**
 * Field-definition registry — the extensibility backbone for Interview
 * Management (see the "Extensibility" requirement in the module spec).
 *
 * Two registries:
 *  - CORE_FIELD_DEFS describes the built-in, typed columns on the Interview
 *    record. It drives the detail view's section grouping/labels, the list
 *    columns, and the filter set — so those never hardcode a field list.
 *  - CUSTOM_FIELD_DEFS describes open-ended metadata stored in the JSON `meta`
 *    column. Appending one entry makes a new field render on the edit form and
 *    detail page and persist — with NO database migration and no bespoke UI.
 *
 * This module is pure (no server/Prisma imports) so both server actions and
 * client components can import it.
 */

export type FieldType = "text" | "longtext" | "url" | "datetime" | "select" | "money" | "file" | "number";

export type FieldSection = "job" | "schedule" | "people" | "custom";

export const SECTION_LABELS: Record<FieldSection, string> = {
  job: "Job",
  schedule: "Schedule",
  people: "People & Files",
  custom: "Additional details",
};

export type CoreFieldDef = {
  /** Stable key — matches the InterviewDetail view property. */
  key: string;
  label: string;
  type: FieldType;
  section: FieldSection;
  /** Render as a column in the interviews list. */
  onList?: boolean;
  /** Expose a filter for this field in the list. */
  filterable?: boolean;
  /** Pre-filled from the linked Application (Resume) when creating from one. */
  prefillFromApplication?: boolean;
};

export const CORE_FIELD_DEFS: CoreFieldDef[] = [
  { key: "jobTitle", label: "Job Title", type: "text", section: "job", onList: true, filterable: true, prefillFromApplication: true },
  { key: "companyName", label: "Company", type: "text", section: "job", onList: true, filterable: true, prefillFromApplication: true },
  { key: "jobPostLink", label: "Job Post Link", type: "url", section: "job", prefillFromApplication: true },
  { key: "salaryRange", label: "Salary Range", type: "text", section: "job" },
  { key: "jobDescription", label: "Job Description", type: "longtext", section: "job", prefillFromApplication: true },
  { key: "scheduledAt", label: "Time", type: "datetime", section: "schedule", onList: true, filterable: true },
  { key: "stage", label: "Interview Process", type: "select", section: "schedule", onList: true, filterable: true },
  { key: "status", label: "Status", type: "select", section: "schedule", onList: true, filterable: true },
  { key: "meetingType", label: "Meeting Type", type: "select", section: "schedule" },
  { key: "meetingLink", label: "Meeting Link", type: "url", section: "schedule" },
  { key: "caller", label: "Caller", type: "select", section: "people", onList: true, filterable: true },
  { key: "interviewerInfo", label: "Interviewer Info", type: "longtext", section: "people" },
  { key: "resume", label: "Resume", type: "file", section: "people", prefillFromApplication: true },
  { key: "referenceFiles", label: "Reference Files", type: "file", section: "people" },
];

/** Core fields shown as list columns, in registry order. */
export const LIST_COLUMN_FIELDS = CORE_FIELD_DEFS.filter((f) => f.onList);

/** Core fields exposed as list filters, in registry order. */
export const FILTERABLE_FIELDS = CORE_FIELD_DEFS.filter((f) => f.filterable);

export type CustomFieldDef = {
  /** Stored at meta[key]. Keep stable once shipped — it's the persisted key. */
  key: string;
  label: string;
  /** Only scalar text/number/url are supported in the generic renderer today. */
  type: "text" | "longtext" | "url" | "number";
  help?: string;
};

/**
 * Future per-interview metadata fields. Empty today — this is the seam the spec
 * calls for. To add e.g. a "Recruiter name" field later, append:
 *   { key: "recruiterName", label: "Recruiter name", type: "text" }
 * and it appears on the form + detail and persists into `meta`, no migration.
 */
export const CUSTOM_FIELD_DEFS: CustomFieldDef[] = [];

export type MetaValues = Record<string, string | number | null>;

/** Reads the known custom-field values out of a stored `meta` JSON blob. */
export function readMetaValues(meta: unknown): MetaValues {
  const source = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const out: MetaValues = {};
  for (const def of CUSTOM_FIELD_DEFS) {
    const raw = source[def.key];
    if (raw === undefined || raw === null) {
      out[def.key] = null;
    } else if (def.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      out[def.key] = Number.isFinite(n) ? n : null;
    } else {
      out[def.key] = String(raw);
    }
  }
  return out;
}
