/**
 * The single definition of a "completed" / billable application, shared by the
 * bidder dashboard (counts + earnings) and the invoicing system so they can
 * never drift apart.
 *
 * An application counts when it has a proof screenshot AND isn't rejected — i.e.
 * approvalStatus is PENDING or APPROVED. (screenshotMimeType is set alongside
 * screenshotData and is cheap to filter on.) A rejected application is excluded
 * even if it has a screenshot.
 */
export const BILLABLE_APPLICATION_WHERE = {
  screenshotMimeType: { not: null },
  approvalStatus: { not: "REJECTED" as const },
};
